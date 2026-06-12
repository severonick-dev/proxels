import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { Request } from 'express';
import { Throttle, seconds } from '@nestjs/throttler';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { UsersService } from '../users/users.service.js';
import { TokensService } from '../auth/tokens.service.js';

class ListQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  take?: number;

  /**
   * По умолчанию `true` — анонимизированные через право на забвение
   * (email `deleted-user-*@anon.proxels.invalid`) скрываются. Передать
   * `false` чтобы увидеть всех.
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'false' || value === false ? false : true)
  excludeDeleted?: boolean;
}

@Controller('admin/users')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminUsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly users: UsersService,
    private readonly tokens: TokensService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  async list(@Query() query: ListQuery) {
    const take = Math.min(query.take ?? 50, 100);
    const skip = query.skip ?? 0;
    const excludeDeleted = query.excludeDeleted !== false;

    const where: Record<string, unknown> = {};
    if (query.q) {
      where.email = { contains: query.q.toLowerCase(), mode: 'insensitive' as const };
    }
    if (excludeDeleted) {
      where.deletedAt = null;
    }

    const now = new Date();
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          emailVerified: true,
          locale: true,
          createdAt: true,
          deletedAt: true,
          totpSecret: true, // только для admin — заменим на boolean ниже
          _count: { select: { subscriptions: true, payments: true } },
          // Активная подписка (только одна — самая свежая) + её план.
          // Нужно для колонок «Тариф» и «Трафик» в админ-таблице.
          subscriptions: {
            where: { status: 'active', endAt: { gt: now } },
            orderBy: { endAt: 'desc' },
            take: 1,
            select: {
              id: true,
              endAt: true,
              trafficUsedBytes: true,
              plan: {
                select: {
                  id: true,
                  name: true,
                  priceRub: true,
                  trafficLimitGb: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      total,
      skip,
      take,
      items: items.map((u) => {
        const sub = u.subscriptions[0] ?? null;
        return {
          id: u.id,
          email: u.email,
          role: u.role,
          emailVerified: u.emailVerified,
          locale: u.locale,
          createdAt: u.createdAt,
          deletedAt: u.deletedAt,
          twofaEnabled: u.totpSecret != null,
          _count: u._count,
          activePlan: sub?.plan
            ? {
                name: sub.plan.name,
                priceRub: sub.plan.priceRub,
                trafficLimitGb: sub.plan.trafficLimitGb,
              }
            : null,
          trafficUsedBytes: sub?.trafficUsedBytes?.toString() ?? null,
          subscriptionEndAt: sub?.endAt ?? null,
          // Привязка соц-сетей пока не реализована — заглушка под будущее.
          // Когда добавим поля User.telegramId / vkId, проставим реальные значения.
          telegramLinked: false,
          vkLinked: false,
        };
      }),
    };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            amountRub: true,
            status: true,
            receiptSent: true,
            subscriptionId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const audit = await this.prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      ...user,
      passwordHash: undefined,
      totpSecret: undefined,
      emailVerifyToken: undefined,
      passwordResetToken: undefined,
      twofaEnabled: user.totpSecret != null,
      auditLog: audit,
    };
  }

  @Post(':id/revoke-sessions')
  @HttpCode(HttpStatus.OK)
  async revokeSessions(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.tokens.revokeAllForUser(id, 'forced');
    await this.audit.record({
      action: 'admin.user.revoke-sessions',
      actorId: admin.id,
      ip: req.ip,
      meta: { userId: id },
    });
    return { ok: true };
  }

  @Post(':id/force-verify')
  @HttpCode(HttpStatus.OK)
  async forceVerify(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.user.update({
      where: { id },
      data: { emailVerified: true, emailVerifyToken: null },
    });
    await this.audit.record({
      action: 'admin.user.force-verify',
      actorId: admin.id,
      ip: req.ip,
      meta: { userId: id },
    });
    return { ok: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forceDelete(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.id === admin.id) {
      // Защита от self-delete через админку.
      throw new NotFoundException('Cannot delete yourself via admin endpoint');
    }
    await this.users.anonymize(id);
    await this.audit.record({
      action: 'admin.user.delete',
      actorId: admin.id,
      ip: req.ip,
      meta: { userId: id, email: user.email },
    });
  }
}
