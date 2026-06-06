import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Node, Prisma, XrayClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { XRAY_NODE_CLIENT, type XrayNodeClient } from './xray.types.js';

/**
 * У ноды настроен опциональный CDN-канал (VLESS+WS через Cloudflare), если
 * все три поля заданы: cdnHost (домен за CF), cdnPath (WS path) и wsInboundTag
 * (имя второго inbound в Xray-конфиге).
 */
export function nodeHasCdn(node: Node): boolean {
  return !!(node.cdnHost && node.cdnPath && node.wsInboundTag);
}

/**
 * Оркестратор работы с множеством нод: создание/удаление XrayClient'ов
 * на всех живых нодах подписки + дёрганье `XrayNodeClient` для добавления
 * клиента в реальный Xray.
 *
 * НИКОГДА не вытаскивает из нод данные о посещаемых клиентом сайтах (§4a).
 * Единственное, что можно тянуть — агрегированные uplink/downlink байты
 * для биллинга трафика (метод `XrayNodeClient.getClientStats`).
 */
@Injectable()
export class XrayService {
  private readonly log = new Logger('Xray');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(XRAY_NODE_CLIENT) private readonly nodeClient: XrayNodeClient,
  ) {}

  /**
   * Найти все ноды (online + isActive), к которым нужно подключить подписку.
   * Если у подписки уже есть XrayClient на ноде — повторно не добавляем.
   * Иначе создаём UUID, дёргаем `nodeClient.addUser`, сохраняем XrayClient.
   *
   * Возвращает финальный список XrayClient'ов с подгруженными нодами.
   *
   * Параметр `tx` опционален — если передан, используется в одной транзакции
   * с вызывающим (напр. PaymentsService при выдаче подписки).
   */
  async materializeForSubscription(
    subscriptionId: string,
    txOpt?: Prisma.TransactionClient,
  ): Promise<(XrayClient & { node: Node })[]> {
    const tx = txOpt ?? this.prisma;

    const sub = await tx.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) {
      this.log.warn({ subscriptionId }, 'materializeForSubscription: sub not found');
      return [];
    }

    const onlineNodes = await tx.node.findMany({
      where: { isActive: true, status: 'online' },
      orderBy: [{ weight: 'desc' }, { name: 'asc' }],
    });

    if (onlineNodes.length === 0) {
      this.log.warn({ subscriptionId }, 'No online nodes — subscription has no endpoints');
      return [];
    }

    const existing = await tx.xrayClient.findMany({
      where: { subscriptionId },
      include: { node: true },
    });
    const haveNodeIds = new Set(existing.map((x) => x.nodeId));

    const created: (XrayClient & { node: Node })[] = [];
    for (const node of onlineNodes) {
      if (haveNodeIds.has(node.id)) continue;

      // По умолчанию выдаём уникальный UUID и регистрируем его на Xray ноде
      // через gRPC `addUser` (`XRAY_CLIENT=grpc`). Поле `Node.fallbackUuid`
      // оставляем как ручной override: если задано — используем его и НЕ
      // зовём addUser (например, чтобы временно подружить с нодой, где gRPC
      // API ещё не настроен — DEV / экстренный мини-режим).
      const useFallback = node.fallbackUuid !== null && node.fallbackUuid !== '';
      const uuid = useFallback ? node.fallbackUuid! : randomUUID();
      try {
        if (!useFallback) {
          await this.nodeClient.addUser(node, uuid, subscriptionId);
        }
      } catch (err) {
        // Если конкретная нода отказала — пропускаем её, но продолжаем с остальными.
        // Failover-логика (Этап 11) пометит её degraded/offline.
        this.log.error(
          { nodeId: node.id, name: node.name, err: (err as Error).message },
          'Failed to add user on node, skipping this node',
        );
        continue;
      }

      // Дополнительный WS+CDN-канал на той же ноде. Best-effort: если он не
      // настроен в Xray-конфиге или CF/DNS ещё не подняты — Reality-канал уже
      // работает, не валим всю подписку.
      if (!useFallback && nodeHasCdn(node)) {
        try {
          await this.nodeClient.addUser(node, uuid, subscriptionId, node.wsInboundTag!);
        } catch (err) {
          this.log.warn(
            { nodeId: node.id, name: node.name, err: (err as Error).message },
            'Failed to add user on WS inbound (Reality already added, continuing)',
          );
        }
      }

      const row = await tx.xrayClient.create({
        data: { subscriptionId, nodeId: node.id, uuid },
        include: { node: true },
      });
      created.push(row);
    }

    // Возвращаем актуальный список (existing + created).
    if (created.length === 0) return existing;
    return [...existing, ...created];
  }

  /**
   * Перерегистрировать всех активных юзеров на конкретной ноде в её Xray.
   *
   * Use cases:
   * - Xray на ноде был перезапущен (in-memory clients потеряны).
   * - У ноды сменился IP (host обновлён через PATCH /admin/nodes/:id) — нужно
   *   пересоздать клиентов в новом инстансе Xray.
   *
   * UUID'ы из БД переиспользуем — клиентам НЕ нужно перевыпускать подписки.
   * RemoveUser пытаемся вызывать перед AddUser (на случай если юзер ещё есть
   * в памяти после graceful reload) — но ошибки игнорируем.
   */
  async reissueOnNode(nodeId: string): Promise<{ ok: number; failed: number; total: number }> {
    const node = await this.prisma.node.findUnique({ where: { id: nodeId } });
    if (!node) {
      this.log.warn({ nodeId }, 'reissueOnNode: node not found');
      return { ok: 0, failed: 0, total: 0 };
    }
    if (node.fallbackUuid && node.fallbackUuid !== '') {
      // На ноде в MVP-режиме (общий fallbackUuid) перезаливать нечего —
      // юзеры зашиты прямо в xray-config, gRPC не используется.
      this.log.log({ nodeId, nodeName: node.name }, 'reissueOnNode: skipped (fallbackUuid mode)');
      return { ok: 0, failed: 0, total: 0 };
    }

    const clients = await this.prisma.xrayClient.findMany({
      where: {
        nodeId,
        subscription: { status: 'active', endAt: { gt: new Date() } },
      },
    });

    let ok = 0;
    let failed = 0;
    const hasCdn = nodeHasCdn(node);
    for (const client of clients) {
      try {
        try {
          await this.nodeClient.removeUser(node, client.subscriptionId);
        } catch {
          // Юзера в Xray и не было — это и есть наш кейс. Молча идём дальше.
        }
        if (hasCdn) {
          try {
            await this.nodeClient.removeUser(node, client.subscriptionId, node.wsInboundTag!);
          } catch {
            // То же самое для WS-инбаунда.
          }
        }
        await this.nodeClient.addUser(node, client.uuid, client.subscriptionId);
        if (hasCdn) {
          try {
            await this.nodeClient.addUser(
              node,
              client.uuid,
              client.subscriptionId,
              node.wsInboundTag!,
            );
          } catch (err) {
            // Reality-канал уже накатили — для WS пишем warning и считаем reissue
            // успешным. Полноценный fix — починить Xray-конфиг ноды.
            this.log.warn(
              { nodeId, subId: client.subscriptionId, err: (err as Error).message },
              'reissueOnNode: WS addUser failed (Reality reissued ok)',
            );
          }
        }
        ok++;
      } catch (err) {
        failed++;
        this.log.error(
          { nodeId, subId: client.subscriptionId, err: (err as Error).message },
          'reissueOnNode: addUser failed',
        );
      }
    }

    this.log.log(
      { nodeId, nodeName: node.name, ok, failed, total: clients.length },
      'reissueOnNode complete',
    );
    return { ok, failed, total: clients.length };
  }

  /**
   * То же самое, но по всем активным нодам. Полезно после массового обновления
   * (рестарт всего парка, миграция Xray-версии, и т.п.).
   */
  async reissueAll(): Promise<
    { nodeId: string; nodeName: string; ok: number; failed: number; total: number }[]
  > {
    const nodes = await this.prisma.node.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    const results = [];
    for (const node of nodes) {
      const r = await this.reissueOnNode(node.id);
      results.push({ nodeId: node.id, nodeName: node.name, ...r });
    }
    return results;
  }

  /** При удалении/отмене подписки — снести клиентов со всех нод. */
  async cleanupForSubscription(subscriptionId: string): Promise<void> {
    const clients = await this.prisma.xrayClient.findMany({
      where: { subscriptionId },
      include: { node: true },
    });
    for (const client of clients) {
      // Если на ноде fallback-UUID (общий) — removeUser не зовём: он бы выкинул
      // всех пользователей на ноде с этим UUID.
      if (client.node.fallbackUuid && client.node.fallbackUuid !== '') continue;
      try {
        await this.nodeClient.removeUser(client.node, subscriptionId);
      } catch (err) {
        this.log.warn(
          { nodeId: client.nodeId, err: (err as Error).message },
          'removeUser failed (continuing)',
        );
      }
      if (nodeHasCdn(client.node)) {
        try {
          await this.nodeClient.removeUser(
            client.node,
            subscriptionId,
            client.node.wsInboundTag!,
          );
        } catch (err) {
          this.log.warn(
            { nodeId: client.nodeId, err: (err as Error).message },
            'removeUser on WS failed (continuing)',
          );
        }
      }
    }
    await this.prisma.xrayClient.deleteMany({ where: { subscriptionId } });
  }
}
