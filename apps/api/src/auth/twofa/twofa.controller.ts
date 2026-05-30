import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import * as argon2 from 'argon2';
import type { Request } from 'express';
import { JwtAccessGuard } from '../guards/jwt-access.guard.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../strategies/jwt-access.strategy.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import { TwoFactorService, type TotpSetupResponse } from './twofa.service.js';

class ConfirmDto {
  @IsString()
  @MinLength(6)
  code!: string;
}

class DisableDto {
  @IsString()
  @MinLength(1)
  password!: string;
}

@Controller('auth/2fa')
@UseGuards(JwtAccessGuard)
export class TwoFactorController {
  constructor(
    private readonly twofa: TwoFactorService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: AuthenticatedUser) {
    const u = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { totpSecret: true },
    });
    return { enabled: u?.totpSecret != null };
  }

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async setup(@CurrentUser() user: AuthenticatedUser): Promise<TotpSetupResponse> {
    return this.twofa.beginSetup(user.id, user.email);
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async confirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ConfirmDto,
    @Req() req: Request,
  ) {
    await this.twofa.confirmSetup(user.id, dto.code);
    await this.audit.record({
      action: 'auth.2fa.enabled',
      actorId: user.id,
      ip: req.ip,
    });
    return { enabled: true };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableDto,
    @Req() req: Request,
  ) {
    const full = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!full) throw new UnauthorizedException();
    const ok = await argon2.verify(full.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid password');
    await this.twofa.disable(user.id);
    await this.audit.record({
      action: 'auth.2fa.disabled',
      actorId: user.id,
      ip: req.ip,
    });
    return { enabled: false };
  }
}
