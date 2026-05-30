import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TokensService } from './tokens.service.js';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy.js';
import { TwoFactorService } from './twofa/twofa.service.js';
import { TwoFactorController } from './twofa/twofa.controller.js';

@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  providers: [AuthService, TokensService, JwtAccessStrategy, TwoFactorService],
  controllers: [AuthController, TwoFactorController],
  exports: [AuthService, TwoFactorService, TokensService],
})
export class AuthModule {}
