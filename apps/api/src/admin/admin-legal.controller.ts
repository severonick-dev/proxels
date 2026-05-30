import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import { LegalDocSlug } from '@prisma/client';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

class UpsertLegalDto {
  @IsString()
  slug!: 'privacy' | 'offer' | 'cookie';

  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  @MinLength(1)
  contentMd!: string;

  @IsString()
  @MinLength(1)
  version!: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

class UpdateLegalDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  contentMd?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

@Controller('admin/legal')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminLegalController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.prisma.legalDoc.findMany({
      orderBy: [{ slug: 'asc' }, { publishedAt: 'desc' }],
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const doc = await this.prisma.legalDoc.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Legal doc not found');
    return doc;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: UpsertLegalDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const slug = parseSlug(dto.slug);
    const doc = await this.prisma.legalDoc.create({
      data: {
        slug,
        title: dto.title,
        contentMd: dto.contentMd,
        version: dto.version,
        publishedAt: dto.publish ? new Date() : null,
      },
    });
    await this.audit.record({
      action: 'admin.legal.create',
      actorId: admin.id,
      ip: req.ip,
      meta: { slug, version: dto.version, id: doc.id },
    });
    return doc;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLegalDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.legalDoc.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Legal doc not found');
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.contentMd !== undefined) data.contentMd = dto.contentMd;
    if (dto.publish === true && existing.publishedAt === null) data.publishedAt = new Date();
    if (dto.publish === false) data.publishedAt = null;
    const doc = await this.prisma.legalDoc.update({ where: { id }, data });
    await this.audit.record({
      action: 'admin.legal.update',
      actorId: admin.id,
      ip: req.ip,
      meta: { id, slug: existing.slug, version: existing.version, publish: dto.publish ?? null },
    });
    return doc;
  }
}

function parseSlug(s: string): LegalDocSlug {
  if (s === 'privacy' || s === 'offer' || s === 'cookie') return s;
  throw new NotFoundException(`Unknown slug: ${s}`);
}
