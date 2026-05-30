import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { SubscriptionsService, type SubscriptionWithPlan } from './subscriptions.service.js';

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
  constructor(private readonly subs: SubscriptionsService) {}

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
}
