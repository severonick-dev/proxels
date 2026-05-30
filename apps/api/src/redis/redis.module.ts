import { Global, Inject, Logger, Module, OnApplicationShutdown, Provider } from '@nestjs/common';
import Redis from 'ioredis';
import { EnvService } from '../config/env.service.js';
import { REDIS_CLIENT } from './redis.constants.js';

const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [EnvService],
  useFactory: (env: EnvService): Redis => {
    const client = new Redis(env.get('REDIS_URL'), {
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    const log = new Logger('Redis');
    client.on('error', (err) => log.error(`Redis error: ${err.message}`));
    client.on('ready', () => log.log('Redis ready'));
    client.on('end', () => log.warn('Redis connection ended'));

    return client;
  },
};

@Global()
@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    if (this.client.status === 'ready' || this.client.status === 'connecting') {
      await this.client.quit();
    }
  }
}
