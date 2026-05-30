import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema.js';
import { EnvService } from './env.service.js';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env читается из CWD, а в монорепо CWD = корень репо при `pnpm dev:api` через корневой скрипт,
      // и = apps/api при запуске из директории apps/api напрямую. Поддерживаем оба варианта.
      envFilePath: ['.env', '../../.env', 'apps/api/.env'],
      validate: validateEnv,
      cache: true,
    }),
  ],
  providers: [EnvService],
  exports: [EnvService],
})
export class AppConfigModule {}
