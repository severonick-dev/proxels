import { Inject, Injectable, Logger } from '@nestjs/common';
import { Node, NodeStatus } from '@prisma/client';
import type Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnvService } from '../config/env.service.js';
import { REDIS_CLIENT } from '../redis/redis.constants.js';
import { tcpProbeWithLatency } from './probe.js';

const KEY_ONLINE_IDS = 'proxels:nodes:online';
const KEY_HEALTH_PREFIX = 'proxels:nodes:health:';
const ONLINE_TTL_SECONDS = 90; // на случай если воркер встал — кэш сам инвалидируется

export interface NodeHealthEntry {
  nodeId: string;
  consecutiveSuccess: number;
  consecutiveFailure: number;
  lastProbeAt: string;
  lastProbeOk: boolean;
  /** TCP-handshake latency RF→нода в мс. null если последний probe упал. */
  latencyMs: number | null;
}

/**
 * Логика health-check и анти-флаппинга:
 *
 *  - Каждый раз когда зашедулен BullMQ job (см. nodes-health.processor) —
 *    вызываем probeAll() → проходим по каждой ноде (isActive=true),
 *    делаем TCP-probe её xrayApiAddr.
 *  - Считаем consecutive successes / failures в Redis.
 *  - Переходы статуса:
 *    - any → online   : когда consecutiveSuccess >= HEALTH_FLAP_UP_THRESHOLD
 *    - any → offline  : когда consecutiveFailure >= HEALTH_FLAP_DOWN_THRESHOLD
 *    - между ними     : degraded (нестабильно)
 *  - Online-кэш списка ID нод хранится в Redis SET с TTL.
 *    `/api/sub/:token` читает его одним SMEMBERS вместо JOIN'а в БД.
 */
@Injectable()
export class NodesHealthService {
  private readonly log = new Logger('NodesHealth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly env: EnvService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Один проход по всем активным нодам. Вызывается из BullMQ-процессора. */
  async probeAll(): Promise<void> {
    const nodes = await this.prisma.node.findMany({ where: { isActive: true } });
    if (nodes.length === 0) {
      await this.refreshOnlineSet([]);
      return;
    }
    const timeoutMs = this.env.get('HEALTH_CHECK_TIMEOUT_MS');
    const results = await Promise.all(
      nodes.map(async (node) => {
        const probe = await tcpProbeWithLatency(node.xrayApiAddr, timeoutMs);
        return { node, ...probe };
      }),
    );

    const onlineIds: string[] = [];
    for (const { node, ok, latencyMs } of results) {
      const newStatus = await this.applyProbeResult(node, ok, latencyMs);
      if (newStatus === NodeStatus.online) onlineIds.push(node.id);
    }
    await this.refreshOnlineSet(onlineIds);
  }

  /** Из кэша Redis (быстрый путь). Если кэш пуст — фолбэк в БД. */
  async getOnlineNodeIds(): Promise<string[]> {
    const cached = await this.redis.smembers(KEY_ONLINE_IDS);
    if (cached.length > 0) return cached;
    // Фолбэк: если воркер ещё не отработал ни одного цикла — берём из БД.
    const fromDb = await this.prisma.node.findMany({
      where: { isActive: true, status: NodeStatus.online },
      select: { id: true },
    });
    return fromDb.map((n) => n.id);
  }

  /** Состояние счётчиков для админки (Этап 12 UI). */
  async getHealthEntries(): Promise<NodeHealthEntry[]> {
    const nodes = await this.prisma.node.findMany({ where: { isActive: true } });
    const out: NodeHealthEntry[] = [];
    for (const node of nodes) {
      const raw = await this.redis.hgetall(KEY_HEALTH_PREFIX + node.id);
      const latRaw = raw.lat;
      const latencyMs = latRaw && latRaw !== '' ? Number(latRaw) : null;
      out.push({
        nodeId: node.id,
        consecutiveSuccess: Number(raw.succ ?? '0'),
        consecutiveFailure: Number(raw.fail ?? '0'),
        lastProbeAt: raw.lastAt ?? '',
        lastProbeOk: raw.lastOk === '1',
        latencyMs: Number.isFinite(latencyMs) ? latencyMs : null,
      });
    }
    return out;
  }

  // ---------------------------------------------------------------------------

  private async applyProbeResult(
    node: Node,
    ok: boolean,
    latencyMs: number | null,
  ): Promise<NodeStatus> {
    const key = KEY_HEALTH_PREFIX + node.id;
    const upThreshold = this.env.get('HEALTH_FLAP_UP_THRESHOLD');
    const downThreshold = this.env.get('HEALTH_FLAP_DOWN_THRESHOLD');

    const raw = await this.redis.hgetall(key);
    const succ = Number(raw.succ ?? '0');
    const fail = Number(raw.fail ?? '0');

    let nextSucc: number;
    let nextFail: number;
    if (ok) {
      nextSucc = succ + 1;
      nextFail = 0;
    } else {
      nextSucc = 0;
      nextFail = fail + 1;
    }

    let nextStatus: NodeStatus = node.status;
    if (ok && nextSucc >= upThreshold) {
      nextStatus = NodeStatus.online;
    } else if (!ok && nextFail >= downThreshold) {
      nextStatus = NodeStatus.offline;
    } else if (node.status === NodeStatus.online && !ok) {
      // первый промах после online — degraded
      nextStatus = NodeStatus.degraded;
    } else if (node.status === NodeStatus.offline && ok) {
      // первая успешная после offline — degraded (ждём ещё)
      nextStatus = NodeStatus.degraded;
    }

    // Persist Redis health entry (TTL: 1 час — на случай если нода исчезла из БД).
    await this.redis
      .multi()
      .hset(key, {
        succ: String(nextSucc),
        fail: String(nextFail),
        lastAt: new Date().toISOString(),
        lastOk: ok ? '1' : '0',
        // На fail оставляем '' — getHealthEntries трактует это как null
        // и UI рисует прочерк. На success всегда перезаписываем актуальной
        // цифрой, чтобы видеть «свежий» RTT, а не последний за всё время.
        lat: latencyMs !== null ? String(latencyMs) : '',
      })
      .expire(key, 3600)
      .exec();

    // Persist в БД только если статус сменился (минимизируем запись).
    if (nextStatus !== node.status) {
      await this.prisma.node.update({
        where: { id: node.id },
        data: { status: nextStatus, lastCheckAt: new Date() },
      });
      this.log.log(
        { nodeId: node.id, name: node.name, from: node.status, to: nextStatus, ok },
        'Node status transition',
      );
    } else {
      // Просто обновляем lastCheckAt без смены статуса — редко, чтобы не дергать БД на каждый probe.
      // Делаем это раз в ~5 проб для надёжности (грязная эвристика — но дешевле батчер).
      if (Math.random() < 0.2) {
        await this.prisma.node.update({
          where: { id: node.id },
          data: { lastCheckAt: new Date() },
        });
      }
    }

    return nextStatus;
  }

  private async refreshOnlineSet(onlineIds: string[]): Promise<void> {
    const pipe = this.redis.multi();
    pipe.del(KEY_ONLINE_IDS);
    if (onlineIds.length > 0) {
      pipe.sadd(KEY_ONLINE_IDS, ...onlineIds);
      pipe.expire(KEY_ONLINE_IDS, ONLINE_TTL_SECONDS);
    }
    await pipe.exec();
  }
}
