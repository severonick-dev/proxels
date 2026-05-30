import {
  BadRequestException,
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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import { PromoKind } from '@prisma/client';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { PromosService } from '../promos/promos.service.js';

class CreatePromoDto {
  @IsString() @Length(2, 32) code!: string;
  @IsEnum(PromoKind) discountKind!: PromoKind;
  @IsInt() @Min(1) @Max(1_000_000) discountValue!: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) maxUses?: number;
  @IsOptional() @IsInt() @Min(0) @Max(1000) perUserLimit?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  appliesToPlanIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class UpdatePromoDto {
  @IsOptional() @IsEnum(PromoKind) discountKind?: PromoKind;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) discountValue?: number;
  @IsOptional() @IsDateString() validFrom?: string | null;
  @IsOptional() @IsDateString() validUntil?: string | null;
  @IsOptional() @IsInt() @Min(1) @Max(1_000_000) maxUses?: number | null;
  @IsOptional() @IsInt() @Min(0) @Max(1000) perUserLimit?: number;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  appliesToPlanIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * Админ-CRUD промокодов + список редемций.
 * Код нормализуется как у валидатора (uppercase, A-Z0-9_-, длина 2..32).
 * Прямое редактирование `usedCount` запрещено — счётчик меняется только
 * через `PromosService.redeemAtomic` в транзакции платежа.
 */
@Controller('admin/promos')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminPromosController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  list(@Query('active') active?: string) {
    return this.prisma.promoCode.findMany({
      where: active === 'true' ? { isActive: true } : undefined,
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  @Get(':id')
  async one(@Param('id') id: string) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    return promo;
  }

  @Get(':id/redemptions')
  async redemptions(
    @Param('id') id: string,
    @Query('take') takeQ?: string,
    @Query('skip') skipQ?: string,
  ) {
    const promo = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!promo) throw new NotFoundException('Promo not found');
    const take = clamp(parseInt(takeQ ?? '50', 10) || 50, 1, 200);
    const skip = clamp(parseInt(skipQ ?? '0', 10) || 0, 0, 100_000);
    const [items, total] = await Promise.all([
      this.prisma.promoRedemption.findMany({
        where: { promoCodeId: id },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.promoRedemption.count({ where: { promoCodeId: id } }),
    ]);
    return { items, total, take, skip };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  async create(
    @Body() dto: CreatePromoDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const code = PromosService.normalize(dto.code);
    if (!code) throw new BadRequestException('Invalid promo code format');
    validateDiscountValue(dto.discountKind, dto.discountValue);

    const promo = await this.prisma.promoCode.create({
      data: {
        code,
        discountKind: dto.discountKind,
        discountValue: dto.discountValue,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        maxUses: dto.maxUses ?? null,
        perUserLimit: dto.perUserLimit ?? 1,
        appliesToPlanIds: dto.appliesToPlanIds ?? [],
        isActive: dto.isActive ?? true,
      },
    });
    await this.audit.record({
      action: 'admin.promo.create',
      actorId: admin.id,
      ip: req.ip,
      meta: {
        promoId: promo.id,
        code: promo.code,
        kind: promo.discountKind,
        value: promo.discountValue,
      },
    });
    return promo;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePromoDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo not found');

    const kind = dto.discountKind ?? existing.discountKind;
    if (dto.discountValue !== undefined) validateDiscountValue(kind, dto.discountValue);

    const data: Record<string, unknown> = {};
    if (dto.discountKind !== undefined) data.discountKind = dto.discountKind;
    if (dto.discountValue !== undefined) data.discountValue = dto.discountValue;
    if (dto.validFrom !== undefined)
      data.validFrom = dto.validFrom === null ? null : new Date(dto.validFrom);
    if (dto.validUntil !== undefined)
      data.validUntil = dto.validUntil === null ? null : new Date(dto.validUntil);
    if (dto.maxUses !== undefined) data.maxUses = dto.maxUses;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;
    if (dto.appliesToPlanIds !== undefined) data.appliesToPlanIds = dto.appliesToPlanIds;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const promo = await this.prisma.promoCode.update({ where: { id }, data });
    await this.audit.record({
      action: 'admin.promo.update',
      actorId: admin.id,
      ip: req.ip,
      meta: { promoId: id, code: existing.code, changed: Object.keys(data) },
    });
    return promo;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Promo not found');
    const promo = await this.prisma.promoCode.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record({
      action: 'admin.promo.deactivate',
      actorId: admin.id,
      ip: req.ip,
      meta: { promoId: id, code: existing.code },
    });
    return promo;
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function validateDiscountValue(kind: PromoKind, value: number): void {
  if (kind === PromoKind.percent && (value < 1 || value > 100)) {
    throw new BadRequestException('percent discountValue must be 1..100');
  }
  if (kind === PromoKind.fixedRub && value < 1) {
    throw new BadRequestException('fixedRub discountValue must be >= 1');
  }
}
