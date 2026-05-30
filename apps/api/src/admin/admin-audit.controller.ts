import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';

class ListQuery {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  take?: number;
}

@Controller('admin/audit')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminAuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  async list(@Query() query: ListQuery) {
    const take = Math.min(query.take ?? 100, 500);
    const skip = query.skip ?? 0;
    const where = {
      ...(query.action ? { action: { startsWith: query.action } } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { total, skip, take, items };
  }
}
