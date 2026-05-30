import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { Throttle } from '@nestjs/throttler';
import { PrismaHealthIndicator } from './prisma.health.js';
import { RedisHealthIndicator } from './redis.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  /**
   * Полный health-check: liveness + DB + Redis.
   * Используется uptime-мониторингом снаружи и docker healthcheck'ом.
   * Поднят лимит throttler'а — health дёргается часто, это не атака.
   */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('postgres'),
      () => this.redisHealth.pingCheck('redis'),
    ]);
  }

  /** Лёгкий liveness-пинг без обращений к зависимостям. */
  @Get('live')
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  live() {
    return { status: 'ok', ts: new Date().toISOString() };
  }
}
