import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, Length } from 'class-validator';
import { Throttle, seconds } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt-access.strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { TwoFactorService } from '../auth/twofa/twofa.service.js';
import { DeployService } from '../deploy/deploy.service.js';

class TriggerDeployDto {
  @IsString() @Length(1, 64) ref!: string;
  /** 6-значный TOTP-код. Без него deploy не запускается, даже если admin вошёл. */
  @IsString() @Length(6, 6) totpCode!: string;
}

class TailQueryDto {
  @IsOptional() lines?: string;
}

/**
 * Admin-эндпоинты для самообновления сервиса:
 *  - GET  /api/admin/deploy/status — git current + remote tags
 *  - POST /api/admin/deploy/refresh — `git ls-remote --tags` без mutate
 *  - POST /api/admin/deploy/run — запустить deploy.sh <ref>. Требует TOTP.
 *  - GET  /api/admin/deploy/log — tail последнего лога деплоя
 *
 * Безопасность:
 *  - JwtAccessGuard + RolesGuard + @Roles('admin').
 *  - POST /run требует пользователя с включённым 2FA, валидный TOTP-код,
 *    и DEPLOY_ENABLED=true на сервере. Сам процесс деплоя НЕ делает API —
 *    он только spawn'ит внешний shell-скрипт `DEPLOY_SCRIPT`.
 *  - Audit на каждое действие (status — без аудита, run/refresh — да).
 */
@Controller('admin/deploy')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('admin')
export class AdminDeployController {
  constructor(
    private readonly deploy: DeployService,
    private readonly audit: AuditService,
    private readonly twofa: TwoFactorService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('status')
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  status() {
    return this.deploy.getStatus();
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async refresh(@CurrentUser() admin: AuthenticatedUser, @Req() req: Request) {
    const remote = await this.deploy.fetchRemoteTags();
    await this.audit.record({
      action: 'admin.deploy.refresh',
      actorId: admin.id,
      ip: req.ip,
      meta: { latestTag: remote.latestTag },
    });
    return remote;
  }

  @Post('run')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  async run(
    @Body() dto: TriggerDeployDto,
    @CurrentUser() admin: AuthenticatedUser,
    @Req() req: Request,
  ) {
    // Жёсткое требование 2FA. Деплой = remote-exec на сервере, без TOTP не
    // запустим даже залогиненного админа.
    const user = await this.prisma.user.findUnique({
      where: { id: admin.id },
      select: { totpSecret: true },
    });
    if (!user?.totpSecret) {
      throw new ForbiddenException({
        message: 'Enable 2FA before running deploy',
        requires2faSetup: true,
      });
    }
    if (!this.twofa.verifyCode(user.totpSecret, dto.totpCode)) {
      throw new BadRequestException({ message: 'Invalid TOTP code', totpInvalid: true });
    }

    const run = await this.deploy.triggerDeploy({ ref: dto.ref });

    await this.audit.record({
      action: 'admin.deploy.run',
      actorId: admin.id,
      ip: req.ip,
      meta: { runId: run.runId, ref: dto.ref },
    });

    return run;
  }

  @Get('log')
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  log(@Query() q: TailQueryDto) {
    const n = q.lines ? parseInt(q.lines, 10) : 200;
    const clamped = Math.max(10, Math.min(1000, isNaN(n) ? 200 : n));
    return this.deploy.tailLog(clamped);
  }
}
