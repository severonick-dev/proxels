import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';

class CreateNodeDto {
  @IsString() @MaxLength(64) name!: string;
  @IsString() @MaxLength(255) host!: string;
  @IsInt() @Min(1) @Max(65535) port!: number;
  @IsString() @MaxLength(8) country!: string;
  @IsString() @MaxLength(255) xrayApiAddr!: string;
  @IsString() @MaxLength(255) publicKey!: string;
  @IsString() @MaxLength(64) shortId!: string;
  @IsString() @MaxLength(255) sni!: string;
  @IsOptional() @IsString() @MaxLength(64) inboundTag?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) weight?: number;
}

class UpdateNodeDto {
  @IsOptional() @IsString() @MaxLength(64) name?: string;
  @IsOptional() @IsString() @MaxLength(255) host?: string;
  @IsOptional() @IsInt() @Min(1) @Max(65535) port?: number;
  @IsOptional() @IsString() @MaxLength(8) country?: string;
  @IsOptional() @IsString() @MaxLength(255) xrayApiAddr?: string;
  @IsOptional() @IsString() @MaxLength(255) publicKey?: string;
  @IsOptional() @IsString() @MaxLength(64) shortId?: string;
  @IsOptional() @IsString() @MaxLength(255) sni?: string;
  @IsOptional() @IsString() @MaxLength(64) inboundTag?: string;
  @IsOptional() @IsInt() @Min(0) @Max(1000) weight?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * CRUD нод. Read и health-картинка — в health-checks/admin-nodes.controller.ts
 * (там же путь /api/admin/nodes/[health]). Здесь — write-операции, чтобы не
 * мешать в одном контроллере.
 */
@Controller('admin/nodes')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminNodesCrudController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  async create(
    @Body() dto: CreateNodeDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const node = await this.prisma.node.create({
      data: {
        ...dto,
        inboundTag: dto.inboundTag ?? 'vless-reality',
        weight: dto.weight ?? 100,
      },
    });
    await this.audit.record({
      action: 'admin.node.create',
      actorId: admin.id,
      ip: req.ip,
      meta: { nodeId: node.id, name: node.name, host: node.host },
    });
    return node;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateNodeDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.node.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Node not found');
    const node = await this.prisma.node.update({ where: { id }, data: dto });
    await this.audit.record({
      action: 'admin.node.update',
      actorId: admin.id,
      ip: req.ip,
      meta: { nodeId: id, changed: Object.keys(dto) },
    });
    return node;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deactivate(
    @Param('id') id: string,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const existing = await this.prisma.node.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Node not found');
    const node = await this.prisma.node.update({
      where: { id },
      data: { isActive: false, status: 'offline' },
    });
    await this.audit.record({
      action: 'admin.node.deactivate',
      actorId: admin.id,
      ip: req.ip,
      meta: { nodeId: id, name: existing.name },
    });
    return node;
  }
}
