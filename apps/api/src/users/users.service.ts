import { Injectable } from '@nestjs/common';
import { Locale, Prisma, User, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export type PublicUser = Pick<
  User,
  'id' | 'email' | 'role' | 'locale' | 'emailVerified' | 'createdAt'
>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Безопасная проекция пользователя для отдачи наружу (без passwordHash и токенов).
   */
  toPublic(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    };
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, deletedAt: null } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: normalizeEmail(email), deletedAt: null },
    });
  }

  findByEmailVerifyToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { emailVerifyToken: token, deletedAt: null },
    });
  }

  findByPasswordResetToken(token: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { passwordResetToken: token, deletedAt: null },
    });
  }

  create(data: {
    email: string;
    passwordHash: string;
    locale: Locale;
    role?: UserRole;
    emailVerifyToken: string | null;
    /** Если задано — используется как есть. Иначе по умолчанию false. */
    emailVerified?: boolean;
    consentPdnVersion: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: normalizeEmail(data.email),
        passwordHash: data.passwordHash,
        locale: data.locale,
        role: data.role ?? UserRole.user,
        emailVerifyToken: data.emailVerifyToken,
        emailVerified: data.emailVerified ?? false,
        consentPdnAt: new Date(),
        consentPdnVersion: data.consentPdnVersion,
      },
    });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true, emailVerifyToken: null },
    });
  }

  rotateEmailVerifyToken(userId: string, token: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifyToken: token },
    });
  }

  setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: token, passwordResetExpiresAt: expiresAt },
    });
  }

  applyNewPassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });
  }

  // Заготовка под право на забвение (Этап 8): анонимизируем ПДн, не удаляя ссылок
  // на Payment/AuditLog. Сам endpoint появится в ЛК на Этапе 8.
  async anonymize(userId: string): Promise<void> {
    const placeholder = `deleted-user-${userId}@anon.proxels.invalid`;
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'forced' },
      });
      await tx.user.update({
        where: { id: userId },
        data: {
          email: placeholder,
          passwordHash: 'invalid',
          emailVerified: false,
          emailVerifyToken: null,
          passwordResetToken: null,
          passwordResetExpiresAt: null,
          totpSecret: null,
          deletedAt: new Date(),
        } satisfies Prisma.UserUncheckedUpdateInput,
      });
    });
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
