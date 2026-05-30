import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { SubscriptionsService, type SubscriptionWithPlan } from './subscriptions.service.js';
import { AuditService } from '../audit/audit.service.js';

class ActivateFreeDto {
  @IsString() @MinLength(1) planId!: string;
}

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

  /**
   * Активация Free-тарифа без YooKassa. Plan должен быть активен и иметь `priceRub == 0`.
   * Если у юзера уже есть активная подписка — 409 (см. SubscriptionsService.activateFreeForUser).
   * Throttle: 3/60s — Free выдаётся редко, а спам активациями не имеет смысла.
   */
  @Post('activate-free')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  async activateFree(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ActivateFreeDto,
    @Req() req: Request,
  ) {
    return this.subs.activateFreeForUser({
      userId: user.id,
      planId: dto.planId,
      ip: req.ip,
    });
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
