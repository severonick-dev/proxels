import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EnvService } from '../config/env.service.js';
import { NodesHealthService } from './nodes-health.service.js';
import { NodesHealthProcessor, HEALTH_QUEUE } from './nodes-health.processor.js';
import { AdminNodesController } from './admin-nodes.controller.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        const url = new URL(env.get('REDIS_URL'));
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
          // Prefix чтобы наши очереди не конфликтовали с throttler-storage и др.
          prefix: 'proxels:bull',
        };
      },
    }),
    BullModule.registerQueue({ name: HEALTH_QUEUE }),
  ],
  controllers: [AdminNodesController],
  providers: [NodesHealthService, NodesHealthProcessor, RolesGuard],
  exports: [NodesHealthService],
})
export class HealthChecksModule {}
