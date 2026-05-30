import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { CONSENT_VERSIONS, PASSWORD_RESET_TTL_MIN } from '@proxels/shared';
import type { User } from '@prisma/client';

import { CaptchaService } from '../captcha/captcha.service.js';
import { MailService } from '../mail/mail.service.js';
import { UsersService } from '../users/users.service.js';
import { generateSecureToken, TokensService, type IssuedRefresh } from './tokens.service.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { ResendVerificationDto } from './dto/resend-verification.dto.js';

export interface ClientCtx {
  ip?: string;
  userAgent?: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
  refresh: IssuedRefresh;
}

const ARGON2_OPTS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MB — OWASP-рекомендованное минимум
  timeCost: 3,
  parallelism: 1,
};

@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokensService,
    private readonly captcha: CaptchaService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Регистрация + верификация
  // ---------------------------------------------------------------------------

  async register(dto: RegisterDto, ctx: ClientCtx): Promise<{ pendingVerification: true }> {
    // Honeypot: если бот заполнил скрытое поле — фальшивый success без создания юзера.
    if (dto.website && dto.website.length > 0) {
      this.log.warn({ ip: ctx.ip }, 'Honeypot triggered on /auth/register');
      return { pendingVerification: true };
    }

    await this.captcha.assertHuman(dto.captchaToken, ctx.ip);

    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      // Не раскрываем существование email'а. На UI просим проверить почту.
      // Внутри логируем для аудита.
      this.log.warn({ email: maskEmail(dto.email) }, 'Register: email already taken');
      return { pendingVerification: true };
    }

    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTS);
    const verifyToken = generateSecureToken(32);

    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      locale: dto.locale ?? 'ru',
      emailVerifyToken: verifyToken,
      consentPdnVersion: CONSENT_VERSIONS.privacy,
    });

    await this.mail.sendEmailVerification(user.email, verifyToken);
    this.log.log({ userId: user.id }, 'User registered, verification email queued');

    return { pendingVerification: true };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    if (!token || token.length < 16) throw new BadRequestException('Invalid token');
    const user = await this.users.findByEmailVerifyToken(token);
    if (!user) throw new BadRequestException('Invalid or expired token');
    if (user.emailVerified) return { verified: true };
    await this.users.markEmailVerified(user.id);
    return { verified: true };
  }

  async resendVerification(dto: ResendVerificationDto, ctx: ClientCtx): Promise<{ queued: true }> {
    await this.captcha.assertHuman(dto.captchaToken, ctx.ip);
    const user = await this.users.findByEmail(dto.email);
    // Не раскрываем существование email'а.
    if (!user || user.emailVerified) return { queued: true };
    const token = generateSecureToken(32);
    await this.users.rotateEmailVerifyToken(user.id, token);
    await this.mail.sendEmailVerification(user.email, token);
    return { queued: true };
  }

  // ---------------------------------------------------------------------------
  // Логин / refresh / logout
  // ---------------------------------------------------------------------------

  async login(dto: LoginDto, ctx: ClientCtx): Promise<LoginResult> {
    await this.captcha.assertHuman(dto.captchaToken, ctx.ip);
    const user = await this.users.findByEmail(dto.email);
    if (!user) {
      // Намеренно делаем «фиктивный» argon2.verify, чтобы выровнять время ответа
      // и не давать сигнал по таймингу о существовании email'а.
      await argon2
        .verify(
          '$argon2id$v=19$m=65536,t=3,p=1$YWFhYWFhYWFhYWFhYWFhYQ$' +
            'aXdHJVHHcq8FmRoq8tncrQrEZmLwTaECMK6RYeMOpf4',
          dto.password,
        )
        .catch(() => false);
      throw new UnauthorizedException('Invalid credentials');
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (!user.emailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const accessToken = this.tokens.issueAccessToken(user);
    const refresh = await this.tokens.issueRefreshToken(user.id, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    return { user, accessToken, refresh };
  }

  async refresh(rawRefreshToken: string, ctx: ClientCtx): Promise<LoginResult> {
    if (!rawRefreshToken) throw new UnauthorizedException('No refresh token');
    const { user, refreshed } = await this.tokens.validateRefreshAndRotate(rawRefreshToken, {
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
    const accessToken = this.tokens.issueAccessToken(user);
    return { user, accessToken, refresh: refreshed };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (rawRefreshToken) {
      await this.tokens.revokeByRawToken(rawRefreshToken, 'logout');
    }
  }

  // ---------------------------------------------------------------------------
  // Сброс пароля
  // ---------------------------------------------------------------------------

  async forgotPassword(dto: ForgotPasswordDto, ctx: ClientCtx): Promise<{ queued: true }> {
    await this.captcha.assertHuman(dto.captchaToken, ctx.ip);
    const user = await this.users.findByEmail(dto.email);
    if (!user) return { queued: true }; // не раскрываем

    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60_000);
    await this.users.setPasswordResetToken(user.id, token, expiresAt);
    await this.mail.sendPasswordReset(user.email, token, PASSWORD_RESET_TTL_MIN);
    return { queued: true };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ ok: true }> {
    const user = await this.users.findByPasswordResetToken(dto.token);
    if (!user || !user.passwordResetExpiresAt) {
      throw new BadRequestException('Invalid or expired token');
    }
    if (user.passwordResetExpiresAt.getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired token');
    }
    const passwordHash = await argon2.hash(dto.newPassword, ARGON2_OPTS);
    await this.users.applyNewPassword(user.id, passwordHash);
    // После смены пароля — отзываем все refresh-токены (вынудим перелогиниться).
    await this.tokens.revokeAllForUser(user.id, 'forced');
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Профиль
  // ---------------------------------------------------------------------------

  async me(userId: string): Promise<User | null> {
    return this.users.findById(userId);
  }

  // ---------------------------------------------------------------------------
  // Конфликт: оставляем хук на случай, если CRUD-методы захотят сигналить о дублях.
  // ---------------------------------------------------------------------------
  throwConflictIf(condition: boolean, message: string): void {
    if (condition) throw new ConflictException(message);
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@', 2);
  if (!local || !domain) return '***';
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}
