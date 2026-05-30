import { Inject, Injectable } from '@nestjs/common';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.constants.js';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.client.ping();
      const ok = pong === 'PONG';
      const result = this.getStatus(key, ok, { response: pong });
      if (!ok) {
        throw new HealthCheckError('Redis returned unexpected response', result);
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      throw new HealthCheckError('Redis check failed', this.getStatus(key, false, { message }));
    }
  }
}
