import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { XrayService } from '../xray/xray.service.js';
import { NodesHealthService } from '../health-checks/nodes-health.service.js';
import { buildVlessUris } from './vless-uri.js';

export interface SubResponse {
  /** Сам список URI (для отладки и админ-просмотра). */
  uris: string[];
  /** Готовый base64-блоб для клиентов. */
  base64Payload: string;
  /** Заголовок Subscription-Userinfo (для клиентов отображать остаток трафика). */
  userInfoHeader: string;
  /** Эпоха истечения подписки в секундах. */
  expireUnix: number;
}

@Injectable()
export class SubService {
  private readonly log = new Logger('Sub');

  constructor(
    private readonly prisma: PrismaService,
    private readonly xray: XrayService,
    private readonly nodesHealth: NodesHealthService,
  ) {}

  /**
   * Главный метод подписочного эндпоинта.
   *
   * Принцип «не раскрывать»: на любые проблемы (sub не найдена, expired,
   * cancelled, нет живых нод) отдаём NotFound без подсказок.
   */
  async resolveBySubToken(subToken: string): Promise<SubResponse> {
    if (!subToken || subToken.length < 16) throw new NotFoundException();

    const sub = await this.prisma.subscription.findUnique({ where: { subToken } });
    if (!sub) throw new NotFoundException();
    if (sub.status !== SubscriptionStatus.active) throw new NotFoundException();
    if (!sub.endAt || sub.endAt.getTime() <= Date.now()) throw new NotFoundException();

    // Быстрый путь: список ID online-нод из Redis-кэша (обновляется BullMQ
    // health-check'ом каждые HEALTH_CHECK_INTERVAL_SECONDS). Если кэш пуст —
    // service сам фолбэк-нётся в БД.
    const onlineNodeIds = await this.nodesHealth.getOnlineNodeIds();

    // Подтянуть XrayClient'ы подписки, отфильтровать только по живым нодам.
    let clients = await this.prisma.xrayClient.findMany({
      where: { subscriptionId: sub.id, nodeId: { in: onlineNodeIds } },
      include: { node: true },
    });
    if (clients.length === 0) {
      // Lazy materialization: возможно в момент оплаты ни одной online-ноды не
      // было, либо появилась новая нода после выпуска подписки.
      const materialized = await this.xray.materializeForSubscription(sub.id);
      clients = materialized.filter((c) => onlineNodeIds.includes(c.node.id));
    }

    if (clients.length === 0) {
      // Подписка валидная, но прямо сейчас нет ни одной живой ноды.
      // Клиенту лучше отдать пустой base64 + Userinfo, чем 404 — чтобы он не сбрасывал
      // конфиг и продолжал переподтягивать через Profile-Update-Interval.
      this.log.warn({ subscriptionId: sub.id }, 'No online nodes for subscription');
    }

    const uris = clients.flatMap((c) => buildVlessUris(c));
    const base64Payload = Buffer.from(uris.join('\n'), 'utf-8').toString('base64');

    const expireUnix = Math.floor(sub.endAt.getTime() / 1000);
    const used = Number(sub.trafficUsedBytes);
    // Если у плана есть лимит, отдаём его, иначе огромное число (1 PiB) — клиенты
    // покажут «безлимит».
    const total = await this.computeTotalBytes(sub.planId);
    const upload = 0; // мы не различаем upload/download на нашей стороне — кладём всё в download.
    const userInfoHeader = `upload=${upload}; download=${used}; total=${total}; expire=${expireUnix}`;

    return { uris, base64Payload, userInfoHeader, expireUnix };
  }

  private async computeTotalBytes(planId: string): Promise<number> {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan?.trafficLimitGb) return 1 << 50; // 1 PiB ≈ безлимит
    return plan.trafficLimitGb * 1024 * 1024 * 1024;
  }
}
