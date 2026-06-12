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

  // Доверяем X-Forwarded-* от nginx-прокси (loopback). Без этого `req.ip`
  // всегда `127.0.0.1`, и YookassaIpGuard режет ЛЮБОЙ webhook (см. этап 5).
  // В dev (без nginx) это no-op — там клиенты приходят напрямую.
  const expressInstance = app.getHttpAdapter().getInstance();
  if (typeof expressInstance.set === 'function') {
    expressInstance.set('trust proxy', 'loopback');
  }

  // Security middleware
  app.use(
    helmet({
      // CSP настраивается на nginx-уровне для прод-фронта; здесь backend — только JSON API.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(cookieParser());

  // CORS — фронт и его www-зеркало строятся из APP_URL. В dev — плюс
  // localhost:5173 для Vite. Так смена домена не требует правок в коде.
  const appUrl = env.get('APP_URL');
  let appHost = '';
  try {
    appHost = new URL(appUrl).host;
  } catch {
    appHost = '';
  }
  const wwwUrl = appHost && !appHost.startsWith('www.') ? `https://www.${appHost}` : null;
  const corsOrigins = env.isProduction
    ? ([appUrl, wwwUrl].filter(Boolean) as string[])
    : [appUrl, 'http://localhost:5173'];
  app.enableCors({
    origin: corsOrigins,
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
