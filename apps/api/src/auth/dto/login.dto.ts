import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from '@proxels/shared';

export class LoginDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsString()
  captchaToken!: string;

  /** TOTP-код (6 цифр) — обязателен для админов, у которых 2FA включена. */
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(10)
  totpCode?: string;
}
