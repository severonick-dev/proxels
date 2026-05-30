import { Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { IsString, Length, MinLength } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromosService, type PromoValidationResult } from './promos.service.js';

class ValidatePromoDto {
  @IsString() @Length(2, 32) code!: string;
  @IsString() @MinLength(1) planId!: string;
}

@Controller('promos')
export class PromosController {
  constructor(
    private readonly promos: PromosService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Live-валидация промокода перед оплатой. На фронте дебаунс 350мс.
   * Возвращает скидку и итоговую сумму либо 400 с `{ promoError: '...' }`.
   */
  @Post('validate')
  @UseGuards(JwtAccessGuard)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  async validate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ValidatePromoDto,
  ): Promise<PromoValidationResult> {
    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      select: { id: true, priceRub: true },
    });
    if (!plan) throw new NotFoundException('Plan not available');

    return this.promos.validateForPurchase({
      code: dto.code,
      userId: user.id,
      planId: plan.id,
      amountRub: plan.priceRub,
    });
  }
}
