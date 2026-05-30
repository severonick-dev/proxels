import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { EnvService } from './config/env.service.js';

// Prisma BigInt → JSON: глобальный сериализатор, иначе JSON.stringify падает.
// (В нашей модели BigInt — это Subscription.trafficUsedBytes.)
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function toJSON() {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: true,
  });

  // Используем pino как nest-logger (вместо встроенного).
  app.useLogger(app.get(Logger));

  const env = app.get(EnvService);

  // Глобальный префикс — все эндпоинты под /api/*.
  app.setGlobalPrefix('api');

  // Security middleware
  app.use(
    helmet({
      // CSP настраивается на nginx-уровне для прод-фронта; здесь backend — только JSON API.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());

  // CORS — только наш фронт. В dev — APP_URL (localhost), в prod — proxels.ru.
  app.enableCors({
    origin: env.isProduction
      ? ['https://proxels.ru', 'https://www.proxels.ru']
      : [env.get('APP_URL'), 'http://localhost:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  app.enableShutdownHooks();

  const port = env.get('API_PORT');
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(
    `Proxels API listening on http://localhost:${port}/api (env=${env.get('NODE_ENV')})`,
    'Bootstrap',
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
