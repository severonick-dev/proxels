import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';
import Redis from 'ioredis';

import { AppConfigModule } from './config/config.module.js';
import { EnvService } from './config/env.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RedisModule } from './redis/redis.module.js';
import { HealthModule } from './health/health.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { buildPinoConfig } from './common/logger/pino.config.js';
import { AuthModule } from './auth/auth.module.js';
import { CaptchaModule } from './captcha/captcha.module.js';
import { MailModule } from './mail/mail.module.js';
import { AuditModule } from './audit/audit.module.js';
import { YookassaModule } from './yookassa/yookassa.module.js';
import { PlansModule } from './plans/plans.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { LegalModule } from './legal/legal.module.js';
import { PublicConfigModule } from './public-config/public-config.module.js';
import { XrayModule } from './xray/xray.module.js';
import { SubModule } from './sub/sub.module.js';
import { HealthChecksModule } from './health-checks/health-checks.module.js';
import { GuidesModule } from './guides/guides.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    AppConfigModule,

    LoggerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) =>
        buildPinoConfig({
          level: env.get('LOG_LEVEL'),
          isProduction: env.isProduction,
        }),
    }),

    ThrottlerModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        // Базовый глобальный лимит. На auth-эндпоинтах далее — собственные жёсткие лимиты (Этап 3).
        throttlers: [{ name: 'default', ttl: seconds(60), limit: 100 }],
        storage: new ThrottlerStorageRedisService(
          new Redis(env.get('REDIS_URL'), { lazyConnect: false }),
        ),
      }),
    }),

    PrismaModule,
    RedisModule,
    CaptchaModule,
    MailModule,
    AuditModule,
    YookassaModule,
    AuthModule,
    XrayModule,
    HealthChecksModule,
    PlansModule,
    SubscriptionsModule,
    PaymentsModule,
    SubModule,
    LegalModule,
    PublicConfigModule,
    GuidesModule,
    AdminModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: false },
        }),
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
