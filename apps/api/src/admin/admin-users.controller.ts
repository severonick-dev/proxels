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
import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
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
    const where = query.q
      ? { email: { contains: query.q.toLowerCase(), mode: 'insensitive' as const } }
      : {};
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
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      total,
      skip,
      take,
      items: items.map((u) => ({
        ...u,
        totpSecret: undefined, // никогда не отдаём наружу
        twofaEnabled: u.totpSecret != null,
      })),
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
