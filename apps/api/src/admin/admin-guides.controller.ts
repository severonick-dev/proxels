import {
  Body,
  Controller,
  Delete,
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
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { GuidesService } from '../guides/guides.service.js';
import { AuditService } from '../audit/audit.service.js';

class CreateGuideDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case (a-z0-9-)' })
  slug!: string;

  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(120) platforms!: string;
  @IsString() @MinLength(1) contentMd!: string;

  @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

class UpdateGuideDto {
  @IsOptional() @IsString() @MaxLength(120) title?: string;
  @IsOptional() @IsString() @MaxLength(120) platforms?: string;
  @IsOptional() @IsString() contentMd?: string;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) sortOrder?: number;
  @IsOptional() @IsBoolean() isPublished?: boolean;
}

@Controller('admin/guides')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminGuidesController {
  constructor(
    private readonly guides: GuidesService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.guides.listAll();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.guides.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateGuideDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const g = await this.guides.create(dto);
    await this.audit.record({
      action: 'admin.guide.create',
      actorId: admin.id,
      ip: req.ip,
      meta: { id: g.id, slug: g.slug },
    });
    return g;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateGuideDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.guides.findById(id).catch(() => null);
    if (!existing) throw new NotFoundException('Guide not found');
    const g = await this.guides.update(id, dto);
    await this.audit.record({
      action: 'admin.guide.update',
      actorId: admin.id,
      ip: req.ip,
      meta: { id, changed: Object.keys(dto) },
    });
    return g;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.guides.findById(id).catch(() => null);
    if (!existing) throw new NotFoundException('Guide not found');
    await this.guides.remove(id);
    await this.audit.record({
      action: 'admin.guide.delete',
      actorId: admin.id,
      ip: req.ip,
      meta: { id, slug: existing.slug },
    });
    return { ok: true };
  }
}
