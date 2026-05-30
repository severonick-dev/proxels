import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import type Redis from 'ioredis';
import { BRAND } from '@proxels/shared';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REDIS_CLIENT } from '../../redis/redis.constants.js';

// TOTP: 30s окно, +/- 1 шаг toleranance — стандарт.
authenticator.options = { window: 1 };

const PENDING_KEY = (userId: string) => `proxels:2fa:pending:${userId}`;
const PENDING_TTL = 600; // 10 минут на завершение setup

export interface TotpSetupResponse {
  /** base32 secret — показать пользователю на случай если QR не сканится. */
  secret: string;
  /** otpauth:// URL для QR. */
  otpauthUrl: string;
}

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Сгенерировать новый pending-secret для пользователя. Не активируем сразу —
   * ждём, пока пользователь введёт верный код в `/auth/2fa/confirm`. Так юзер
   * не залочит себя, если QR не отсканится корректно.
   */
  async beginSetup(userId: string, email: string): Promise<TotpSetupResponse> {
    const secret = authenticator.generateSecret();
    await this.redis.set(PENDING_KEY(userId), secret, 'EX', PENDING_TTL);
    const otpauthUrl = authenticator.keyuri(email, BRAND.name, secret);
    return { secret, otpauthUrl };
  }

  /** Подтвердить setup кодом из приложения. На успехе записать в User.totpSecret. */
  async confirmSetup(userId: string, code: string): Promise<void> {
    const pending = await this.redis.get(PENDING_KEY(userId));
    if (!pending) throw new BadRequestException('Setup not started or expired');
    if (!authenticator.check(code.trim(), pending)) {
      throw new BadRequestException('Invalid TOTP code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: pending },
    });
    await this.redis.del(PENDING_KEY(userId));
  }

  /** Отключение 2FA. Caller (контроллер) уже проверил пароль. */
  async disable(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null },
    });
  }

  /** Проверить код в процессе логина админа. */
  verifyCode(secret: string, code: string): boolean {
    if (!code) return false;
    return authenticator.check(code.trim(), secret);
  }
}
