import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { YookassaIpGuard } from '../../yookassa/yookassa-ip.guard.js';
import type { YookassaWebhookNotification } from '../../yookassa/yookassa.types.js';
import { PaymentsService } from '../payments.service.js';

/**
 * Webhook YooKassa. Маршрут `POST /api/payments/webhook`.
 *
 * Безопасность (§4b):
 *  - YookassaIpGuard режет всё, что не из CIDR YooKassa (плюс localhost в dev).
 *  - В processWebhookEvent — идемпотентность, проверка суммы, audit-лог.
 *  - ValidationPipe (whitelist+forbidNonWhitelisted) отсекает мусорные поля.
 *
 * Не используем class-validator на теле: YooKassa может расширять формат, поэтому
 * валидируем минимально на стороне сервиса. Парсинг — нативный JSON.
 */
@Controller('payments/webhook')
@UseGuards(YookassaIpGuard)
export class PaymentsWebhookController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 600, ttl: seconds(60) } })
  async handle(@Body() body: YookassaWebhookNotification, @Req() req: Request) {
    await this.payments.processWebhookEvent(body, req.ip);
    return { received: true };
  }
}
