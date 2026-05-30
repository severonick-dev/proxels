import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Response } from 'express';
import { SubService } from './sub.service.js';

/**
 * Подписочный эндпоинт. Дёргается VLESS-клиентами (Nekobox, Hiddify, V2RayTun)
 * по URL вида `https://proxels.ru/api/sub/<subToken>`.
 *
 * Особенности:
 *  - Throttle жёсткий: на каждый IP — 30/60s. Защита от перебора subToken'ов
 *    (см. §4b CLAUDE.md). Сам токен >= 32 байта random, чтобы перебор был
 *    математически невозможен.
 *  - Content-Type: text/plain (так клиенты ожидают; JSON они не понимают).
 *  - Subscription-Userinfo: отображает остаток трафика/времени в клиентах.
 *  - Profile-Update-Interval: 24 ч — клиент сам перетянет конфиг и подхватит
 *    new node / failover.
 *  - Никакого CORS — это not browser endpoint.
 */
@Controller('sub')
export class SubController {
  constructor(private readonly sub: SubService) {}

  @Get(':subToken')
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @Header('Profile-Update-Interval', '24')
  @Header('Profile-Title', 'Proxels')
  // Не разрешаем кешировать прокси/CDN — мы хотим, чтобы failover отражался сразу.
  @Header('Cache-Control', 'no-store')
  async fetch(
    @Param('subToken') subToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const result = await this.sub.resolveBySubToken(subToken);
    res.setHeader('Subscription-Userinfo', result.userInfoHeader);
    return result.base64Payload;
  }
}
