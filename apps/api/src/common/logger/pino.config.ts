import { randomUUID } from 'node:crypto';
import type { Params } from 'nestjs-pino';

/**
 * Конфиг pino-логгера для backend.
 *
 * Принципы (см. CLAUDE.md §4a):
 *  - Не логируем тела запросов/ответов (могут содержать пароли, ПДн, токены).
 *  - Не логируем cookie и Authorization-заголовки.
 *  - В dev — pino-pretty, в prod — JSON-логи для агрегаторов.
 *  - subToken / UUID клиентов и т.п. — если попадают в URL, прячем за маской.
 *
 * Бекенд не видит трафик клиентов через VPN — он идёт мимо Node.js,
 * напрямую через Xray на нодах. Здесь только HTTP-запросы к API.
 */
export function buildPinoConfig(opts: { level: string; isProduction: boolean }): Params {
  return {
    pinoHttp: {
      level: opts.level,
      genReqId: (req): string => {
        const existing = (req as { id?: unknown }).id;
        return typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
      },
      autoLogging: {
        ignore: (req) => req.url === '/api/health' || req.url === '/api/health/live',
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'req.headers["x-api-key"]',
          'req.body.password',
          'req.body.newPassword',
          'req.body.currentPassword',
          'req.body.token',
          'req.body.refreshToken',
          'req.body.totpCode',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
      serializers: {
        req(req: { method?: string; url?: string; id?: string; remoteAddress?: string }) {
          return {
            id: req.id,
            method: req.method,
            // Маскируем хвосты subToken'ов и id'шников в URL, чтобы случайно не утекли в логи.
            url: maskSensitivePathSegments(req.url ?? ''),
            remoteAddress: req.remoteAddress,
          };
        },
        res(res: { statusCode?: number }) {
          return { statusCode: res.statusCode };
        },
      },
      transport: opts.isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,req.id,req.remoteAddress',
            },
          },
    },
  };
}

const SENSITIVE_PATH_PREFIXES = ['/api/sub/', '/api/auth/verify/', '/api/auth/reset/'];

function maskSensitivePathSegments(url: string): string {
  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (url.startsWith(prefix)) {
      const tail = url.slice(prefix.length);
      const masked =
        tail.length > 6 ? `${'*'.repeat(Math.max(0, tail.length - 4))}${tail.slice(-4)}` : '***';
      return `${prefix}${masked}`;
    }
  }
  return url;
}
