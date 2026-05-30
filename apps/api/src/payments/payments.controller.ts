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
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PaymentsService, type PublicPayment } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { EnvService } from '../config/env.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly env: EnvService,
  ) {}

  // --- self-read ------------------------------------------------------------

  @Get('me')
  @UseGuards(JwtAccessGuard)
  myList(@CurrentUser() user: AuthenticatedUser): Promise<PublicPayment[]> {
    return this.payments.listForUser(user.id);
  }

  @Get('me/:id')
  @UseGuards(JwtAccessGuard)
  myOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PublicPayment> {
    return this.payments.findOneForUser(user.id, id);
  }

  // --- create payment -------------------------------------------------------

  /**
   * Создать платёж в YooKassa. Тело: planId + offerAccepted + опц. returnUrl.
   * Throttle: жёсткий — обычный юзер не должен создавать платежи десятками в секунду.
   */
  @Post('create')
  @UseGuards(JwtAccessGuard)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
    @Req() req: Request,
  ) {
    return this.payments.createForUser({
      userId: user.id,
      userEmail: user.email,
      planId: dto.planId,
      offerAccepted: dto.offerAccepted,
      returnUrl: dto.returnUrl,
      ip: req.ip,
    });
  }

  // --- dev-only helper (бессмысленный в prod) -------------------------------

  /**
   * Симуляция payment.succeeded для платежей, созданных в dev-bypass-режиме.
   * Дёргать руками из curl, чтобы пройти e2e-сценарий без реальной YooKassa.
   * В production эндпоинт молча отвечает 403 (см. PaymentsService.devSimulateSucceeded).
   */
  @Post('dev/simulate-succeeded/:yookassaId')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async devSimulate(
    @CurrentUser() _user: AuthenticatedUser,
    @Param('yookassaId') yookassaId: string,
    @Req() req: Request,
  ) {
    await this.payments.devSimulateSucceeded(yookassaId, req.ip);
    return { ok: true, devBypass: this.env.isDevelopment };
  }
}
