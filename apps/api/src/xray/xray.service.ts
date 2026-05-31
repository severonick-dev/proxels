import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Node, Prisma, XrayClient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { XRAY_NODE_CLIENT, type XrayNodeClient } from './xray.types.js';

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

      // MVP: если на ноде проставлен `fallbackUuid` — используем его как общий
      // UUID для всех подписок (Xray статически принимает только этот UUID на
      // данной ноде, gRPC AddUser не нужен). Иначе — случайный UUID, который
      // должен зарегистрироваться через `nodeClient.addUser` (gRPC-режим).
      const uuid = node.fallbackUuid ?? randomUUID();
      try {
        await this.nodeClient.addUser(node, uuid, subscriptionId);
      } catch (err) {
        // Если конкретная нода отказала — пропускаем её, но продолжаем с остальными.
        // Failover-логика (Этап 11) пометит её degraded/offline.
        this.log.error(
          { nodeId: node.id, name: node.name, err: (err as Error).message },
          'Failed to add user on node, skipping this node',
        );
        continue;
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

  /** При удалении/отмене подписки — снести клиентов со всех нод. */
  async cleanupForSubscription(subscriptionId: string): Promise<void> {
    const clients = await this.prisma.xrayClient.findMany({
      where: { subscriptionId },
      include: { node: true },
    });
    for (const client of clients) {
      try {
        await this.nodeClient.removeUser(client.node, subscriptionId);
      } catch (err) {
        this.log.warn(
          { nodeId: client.nodeId, err: (err as Error).message },
          'removeUser failed (continuing)',
        );
      }
    }
    await this.prisma.xrayClient.deleteMany({ where: { subscriptionId } });
  }
}
