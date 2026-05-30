import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { AuditService } from '../audit/audit.service.js';
import { NewsService } from '../news/news.service.js';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class CreateNewsDto {
  @IsString()
  @Matches(SLUG_REGEX, { message: 'slug must be kebab-case (a-z0-9 with hyphens)' })
  @MaxLength(64)
  slug!: string;

  @IsString() @MinLength(1) @MaxLength(160) title!: string;
  @IsString() @MinLength(1) @MaxLength(320) summary!: string;
  @IsString() @MinLength(1) contentMd!: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

class UpdateNewsDto {
  @IsOptional() @IsString() @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(320) summary?: string;
  @IsOptional() @IsString() contentMd?: string;
  @IsOptional() @IsBoolean() publish?: boolean;
}

@Controller('admin/news')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminNewsController {
  constructor(
    private readonly news: NewsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list() {
    return this.news.listAll();
  }

  @Get(':id')
  one(@Param('id') id: string) {
    return this.news.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  async create(
    @Body() dto: CreateNewsDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    if (!SLUG_REGEX.test(dto.slug)) throw new BadRequestException('Invalid slug');
    const post = await this.news.create({
      slug: dto.slug,
      title: dto.title,
      summary: dto.summary,
      contentMd: dto.contentMd,
      publish: dto.publish ?? false,
    });
    await this.audit.record({
      action: 'admin.news.create',
      actorId: admin.id,
      ip: req.ip,
      meta: { newsId: post.id, slug: post.slug, publish: dto.publish ?? false },
    });
    return post;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNewsDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const post = await this.news.update(id, dto);
    await this.audit.record({
      action: 'admin.news.update',
      actorId: admin.id,
      ip: req.ip,
      meta: { newsId: id, changed: Object.keys(dto), publish: dto.publish ?? null },
    });
    return post;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const post = await this.news.findById(id);
    await this.news.remove(id);
    await this.audit.record({
      action: 'admin.news.delete',
      actorId: admin.id,
      ip: req.ip,
      meta: { newsId: id, slug: post.slug },
    });
    return { ok: true };
  }
}
