import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, seconds } from '@nestjs/throttler';
import { REFRESH_COOKIE_NAME } from '@proxels/shared';
import type { CookieOptions, Request, Response } from 'express';

import { EnvService } from '../config/env.service.js';
import { AuthService, type ClientCtx, type LoginResult } from './auth.service.js';
import { JwtAccessGuard } from './guards/jwt-access.guard.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { AuthenticatedUser } from './strategies/jwt-access.strategy.js';
import { UsersService } from '../users/users.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { DeleteAccountDto } from './dto/delete-account.dto.js';

const REFRESH_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly env: EnvService,
  ) {}

  // -- регистрация / верификация ---------------------------------------------

  @Post('register')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.auth.register(dto, this.ctx(req));
  }

  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  verifyEmail(@Query('token') token: string) {
    return this.auth.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  resend(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    return this.auth.resendVerification(dto, this.ctx(req));
  }

  // -- логин / refresh / logout ----------------------------------------------

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.login(dto, this.ctx(req));
    this.setRefreshCookie(res, result);
    return this.buildLoginBody(result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: seconds(60) } })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    const result = await this.auth.refresh(raw ?? '', this.ctx(req));
    this.setRefreshCookie(res, result);
    return this.buildLoginBody(result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: seconds(60) } })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await this.auth.logout(raw);
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions(0));
  }

  // -- сброс пароля ----------------------------------------------------------

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  forgot(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.auth.forgotPassword(dto, this.ctx(req));
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: seconds(60) } })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  // -- профиль ---------------------------------------------------------------

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    const full = await this.auth.me(user.id);
    return full ? this.users.toPublic(full) : null;
  }

  // -- смена пароля / удаление аккаунта --------------------------------------

  @Post('change-password')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: seconds(60) } })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      this.ctx(req),
    );
    // Сами тоже выкидываем cookie — пользователь перелогинится в браузере.
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions(0));
    return result;
  }

  /**
   * Удалить аккаунт. Требует ввод текущего пароля. Анонимизирует ПДн и отзывает
   * все сессии. Право на забвение по 152-ФЗ (см. §4 CLAUDE.md).
   */
  @Delete('me')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 3, ttl: seconds(60) } })
  async deleteMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.deleteAccount(user.id, dto.currentPassword, this.ctx(req));
    res.clearCookie(REFRESH_COOKIE_NAME, this.cookieOptions(0));
  }

  // -- helpers ---------------------------------------------------------------

  private ctx(req: Request): ClientCtx {
    return {
      ip: req.ip,
      userAgent: req.headers['user-agent']?.toString(),
    };
  }

  private buildLoginBody(result: LoginResult) {
    return {
      accessToken: result.accessToken,
      user: this.users.toPublic(result.user),
    };
  }

  private setRefreshCookie(res: Response, result: LoginResult): void {
    const maxAgeMs = result.refresh.expiresAt.getTime() - Date.now();
    res.cookie(REFRESH_COOKIE_NAME, result.refresh.rawToken, this.cookieOptions(maxAgeMs));
  }

  private cookieOptions(maxAgeMs: number): CookieOptions {
    const isProd = this.env.isProduction;
    return {
      httpOnly: true,
      secure: isProd || this.env.get('COOKIE_SECURE'),
      sameSite: isProd ? 'strict' : 'lax',
      domain: this.env.get('COOKIE_DOMAIN'),
      // Refresh-cookie отдаётся только на /api/auth/* — снижает поверхность атаки.
      path: REFRESH_PATH,
      maxAge: maxAgeMs > 0 ? maxAgeMs : 0,
    };
  }
}
