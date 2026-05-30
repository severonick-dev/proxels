import { Controller, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { SubscriptionsService, type SubscriptionWithPlan } from './subscriptions.service.js';
import { AuditService } from '../audit/audit.service.js';

/**
 * Read-only API подписок текущего пользователя.
 * Создание подписки — через успешный платёж ЮKassa (Этап 5),
 * выдача subscription-ссылки — Этап 10.
 *
 * Эндпоинт BIGINT-полей (Subscription.trafficUsedBytes) — конвертится в строку
 * глобальным BigInt→JSON сериализатором (main.ts).
 */
@Controller('subscriptions')
@UseGuards(JwtAccessGuard)
export class SubscriptionsController {
  constructor(
    private readonly subs: SubscriptionsService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  myList(@CurrentUser() user: AuthenticatedUser): Promise<SubscriptionWithPlan[]> {
    return this.subs.listForUser(user.id);
  }

  @Get('me/:id')
  myOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<SubscriptionWithPlan> {
    return this.subs.findOneForUser(user.id, id);
  }

  /** Ротация subscription-токена. См. §4a — пользователь может в любой момент инвалидировать ссылку. */
  @Post('me/:id/rotate-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async rotateToken(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SubscriptionWithPlan> {
    const updated = await this.subs.rotateSubTokenForUser(user.id, id);
    await this.audit.record({
      action: 'subscription.rotate-token',
      actorId: user.id,
      ip: req.ip,
      meta: { subscriptionId: id },
    });
    return updated;
  }
}
