import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Plan, Prisma, Subscription, SubscriptionStatus } from '@prisma/client';
import { SUB_TOKEN_BYTES } from '@proxels/shared';
import { PrismaService } from '../prisma/prisma.service.js';

export type SubscriptionWithPlan = Subscription & { plan: Plan };

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string): Promise<SubscriptionWithPlan[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneForUser(userId: string, id: string): Promise<SubscriptionWithPlan> {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: { plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  /**
   * Ротация subToken по запросу пользователя из ЛК (см. §4a).
   * Старый subToken инвалидируется: больше не будет находиться по `/api/sub/<old>`.
   * Клиенту нужно скопировать новую ссылку в приложение (или пересканить QR).
   *
   * Не трогает связанные XrayClient'ы — они привязаны к подписке, не к токену.
   */
  async rotateSubTokenForUser(userId: string, subId: string): Promise<SubscriptionWithPlan> {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subId, userId },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { subToken: generateSubToken(), subTokenRotatedAt: new Date() },
      include: { plan: true },
    });
  }

  /**
   * Активация/продление подписки по успешному платежу.
   *
   * Логика:
   *  1) Если у пользователя есть активная подписка на этот же план с endAt > now —
   *     продлеваем её (`endAt += plan.durationDays`). Это естественный «продлить тариф».
   *  2) Иначе создаём новую `Subscription` со статусом active, startAt=now,
   *     endAt=now+plan.durationDays, новым случайным subToken.
   *
   * Используется ТОЛЬКО из PaymentsService.processWebhookEvent — там же запекается
   * в общую транзакцию (чтобы payment + sub шли атомарно).
   */
  async createOrExtendForPayment(
    tx: Prisma.TransactionClient,
    args: { userId: string; planId: string },
  ): Promise<Subscription> {
    const plan = await tx.plan.findUnique({ where: { id: args.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    const now = new Date();
    const existing = await tx.subscription.findFirst({
      where: {
        userId: args.userId,
        planId: args.planId,
        status: SubscriptionStatus.active,
        endAt: { gt: now },
      },
      orderBy: { endAt: 'desc' },
    });

    if (existing) {
      const newEnd = addDays(existing.endAt ?? now, plan.durationDays);
      return tx.subscription.update({
        where: { id: existing.id },
        data: { endAt: newEnd },
      });
    }

    const endAt = addDays(now, plan.durationDays);
    return tx.subscription.create({
      data: {
        userId: args.userId,
        planId: args.planId,
        status: SubscriptionStatus.active,
        startAt: now,
        endAt,
        subToken: generateSubToken(),
      },
    });
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * subToken для подписки — 32 байта random, base64url. См. §4a.
 * Подписка с такой токеном доступна по `GET /api/sub/<token>` (Этап 10).
 */
function generateSubToken(): string {
  return randomBytes(SUB_TOKEN_BYTES).toString('base64url');
}
