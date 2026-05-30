import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { Request } from 'express';
import { EnvService } from '../config/env.service.js';

/**
 * Webhook YooKassa-а должен прилетать ТОЛЬКО с её адресов.
 * Источник: https://yookassa.ru/developers/using-api/webhooks (на момент Этапа 5).
 * Список нужно перечекивать при обновлении YooKassa или при сбоях.
 */
const YOOKASSA_CIDR_V4 = [
  '185.71.76.0/27',
  '185.71.77.0/27',
  '77.75.153.0/25',
  '77.75.156.11/32',
  '77.75.156.35/32',
  '77.75.154.128/25',
  '2.59.41.0/24',
];

// IPv6 матчер мы не реализуем (редко нужно в нашей конфигурации); префикс держим
// в списке для документирования. Если webhook прилетит по IPv6 — будет 403 и в логе
// предупреждение. Решение: сделать nginx, который проксирует webhook по IPv4.
const YOOKASSA_V6_PREFIXES = ['2a02:5180:'];

@Injectable()
export class YookassaIpGuard implements CanActivate {
  private readonly log = new Logger('YookassaIpGuard');

  constructor(private readonly env: EnvService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    const ip = normalizeIp(req.ip);
    if (!ip) {
      throw new ForbiddenException('Missing source IP');
    }

    // В dev разрешаем localhost для удобства тестов.
    if (!this.env.isProduction && isLocalhost(ip)) return true;

    if (matchesAny(ip, this.allowedCidrs())) return true;

    this.log.warn({ ip }, 'Rejected webhook from non-whitelisted IP');
    throw new ForbiddenException('Source IP not allowed');
  }

  private allowedCidrs(): string[] {
    const extra = this.env.get('YOOKASSA_EXTRA_WEBHOOK_IPS');
    return [...YOOKASSA_CIDR_V4, ...extra];
  }
}

function normalizeIp(raw: string | undefined): string | null {
  if (!raw) return null;
  // Express может вернуть "::ffff:1.2.3.4" — это IPv4-mapped IPv6, отрезаем префикс.
  if (raw.startsWith('::ffff:')) return raw.slice(7);
  return raw;
}

function isLocalhost(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost';
}

function matchesAny(ip: string, cidrs: string[]): boolean {
  for (const cidr of cidrs) {
    if (cidrContains(cidr, ip)) return true;
  }
  for (const prefix of YOOKASSA_V6_PREFIXES) {
    if (ip.toLowerCase().startsWith(prefix.toLowerCase())) return true;
  }
  return false;
}

/**
 * Простой проверщик IPv4 CIDR. Для IPv6 — отдельный prefix check выше.
 */
function cidrContains(cidr: string, ip: string): boolean {
  const [base, bitsStr] = cidr.split('/', 2);
  if (!base || !bitsStr) return false;
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let acc = 0;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    acc = (acc << 8) | n;
  }
  return acc >>> 0;
}
