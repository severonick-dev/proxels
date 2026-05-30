import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { UsersModule } from '../users/users.module.js';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { TokensService } from './tokens.service.js';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy.js';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // Секреты передаём явно при подписи/верификации в TokensService,
    // чтобы access и refresh жили на разных ключах.
    JwtModule.register({}),
  ],
  providers: [AuthService, TokensService, JwtAccessStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
