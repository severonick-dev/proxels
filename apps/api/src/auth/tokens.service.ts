import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import { nanoid } from 'nanoid';
import type { RefreshToken, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EnvService } from '../config/env.service.js';

export interface AccessTokenPayload {
  sub: string;
  role: User['role'];
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  fam: string;
}

export interface IssuedRefresh {
  rawToken: string;
  jti: string;
  familyId: string;
  expiresAt: Date;
}

@Injectable()
export class TokensService {
  private readonly log = new Logger('Tokens');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly env: EnvService,
  ) {}

  // ---------------------------------------------------------------------------
  // Access
  // ---------------------------------------------------------------------------

  issueAccessToken(user: Pick<User, 'id' | 'role' | 'email'>): string {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, email: user.email };
    return this.jwt.sign(payload, {
      secret: this.env.get('JWT_ACCESS_SECRET'),
      // jsonwebtoken @types требует число секунд или литерал; ENV — строка, поэтому в seconds.
      expiresIn: Math.floor(parseTtlToMs(this.env.get('JWT_ACCESS_TTL')) / 1000),
    });
  }

  // ---------------------------------------------------------------------------
  // Refresh: issue, rotate, validate, revoke
  // ---------------------------------------------------------------------------

  async issueRefreshToken(
    userId: string,
    opts: { familyId?: string; ip?: string; userAgent?: string },
  ): Promise<IssuedRefresh> {
    const familyId = opts.familyId ?? nanoid(21);
    const jti = nanoid(21);
    const ttlMs = parseTtlToMs(this.env.get('JWT_REFRESH_TTL'));
    const expiresAt = new Date(Date.now() + ttlMs);

    const payload: RefreshTokenPayload = { sub: userId, jti, fam: familyId };
    const rawToken = this.jwt.sign(payload, {
      secret: this.env.get('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(ttlMs / 1000),
    });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        familyId,
        jti,
        tokenHash: hashToken(rawToken),
        expiresAt,
        ip: opts.ip,
        userAgent: opts.userAgent?.slice(0, 255),
      },
    });

    return { rawToken, jti, familyId, expiresAt };
  }

  /**
   * Валидация refresh-токена с детекцией повторного использования.
   * Если пришёл token, у которого jti уже отозван, — это reuse: отзываем всю family.
   */
  async validateRefreshAndRotate(
    rawToken: string,
    opts: { ip?: string; userAgent?: string },
  ): Promise<{ user: User; refreshed: IssuedRefresh }> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwt.verify<RefreshTokenPayload>(rawToken, {
        secret: this.env.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.userId !== payload.sub) {
      // Подпись валидна, но в БД нет — токен был ротирован/удалён.
      // Если это уже использованный (replacedById!==null) — это reuse: отозвать всю family.
      const byJti = await this.prisma.refreshToken.findUnique({ where: { jti: payload.jti } });
      if (byJti && byJti.replacedById !== null) {
        await this.revokeFamily(byJti.familyId, 'reuse');
        this.log.warn(
          { userId: byJti.userId, familyId: byJti.familyId },
          'Refresh token reuse detected — family revoked',
        );
      }
      throw new UnauthorizedException('Refresh token not recognised');
    }

    if (stored.revokedAt) {
      // Токен формально валиден, но отозван — reuse.
      await this.revokeFamily(stored.familyId, 'reuse');
      this.log.warn(
        { userId: stored.userId, familyId: stored.familyId },
        'Revoked refresh token replayed — family revoked',
      );
      throw new UnauthorizedException('Refresh token revoked');
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: stored.userId, deletedAt: null },
    });
    if (!user) throw new UnauthorizedException('User not found');

    // Ротация: создаём новый refresh в той же family, помечаем старый как replaced+revoked.
    const issued = await this.issueRefreshToken(user.id, {
      familyId: stored.familyId,
      ip: opts.ip,
      userAgent: opts.userAgent,
    });
    const replacement = await this.prisma.refreshToken.findUnique({ where: { jti: issued.jti } });
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: {
        replacedById: replacement?.id ?? null,
        revokedAt: new Date(),
        revokedReason: 'rotation',
      },
    });

    return { user, refreshed: issued };
  }

  async revokeByRawToken(rawToken: string, reason: RefreshToken['revokedReason']): Promise<void> {
    const tokenHash = hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeFamily(
    familyId: string,
    reason: NonNullable<RefreshToken['revokedReason']>,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }

  async revokeAllForUser(
    userId: string,
    reason: NonNullable<RefreshToken['revokedReason']>,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Преобразует "15m" / "30d" / "12h" / "60s" в миллисекунды.
 * Используется для расчёта expiresAt и cookie maxAge.
 */
function parseTtlToMs(ttl: string): number {
  const m = /^(\d+)\s*([smhd])$/i.exec(ttl.trim());
  if (!m) {
    // Если просто число — считаем что секунды.
    const asNumber = Number(ttl);
    if (Number.isFinite(asNumber) && asNumber > 0) return asNumber * 1000;
    throw new Error(`Invalid TTL: ${ttl}`);
  }
  const n = Number(m[1]);
  const unit = m[2]!.toLowerCase();
  switch (unit) {
    case 's':
      return n * 1_000;
    case 'm':
      return n * 60_000;
    case 'h':
      return n * 3_600_000;
    case 'd':
      return n * 86_400_000;
    default:
      throw new Error(`Invalid TTL unit: ${unit}`);
  }
}

export const __test = { hashToken, parseTtlToMs, generateSecureToken };

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}
