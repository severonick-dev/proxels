import {
  Equals,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Locale } from '@prisma/client';
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@proxels/shared';

export class RegisterDto {
  @IsEmail({}, { message: 'Invalid email' })
  @MaxLength(EMAIL_MAX_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @IsEnum(Locale)
  @IsOptional()
  locale?: Locale;

  /**
   * Согласие на обработку ПДн (152-ФЗ). Обязательно true — иначе регистрация невозможна.
   * Версия согласия фиксируется на бэке из @proxels/shared CONSENT_VERSIONS.privacy.
   */
  @Equals(true, { message: 'Consent for personal data processing is required (152-ФЗ)' })
  consentPdn!: boolean;

  /** Токен капчи с фронта. Не нужен только при CAPTCHA_PROVIDER=none (dev). */
  @IsString()
  captchaToken!: string;

  /**
   * Honeypot. Скрытое поле в форме фронта; настоящий пользователь его не видит.
   * Если бот заполнит — AuthService.register даст «успех» БЕЗ создания пользователя
   * (silent fake), чтобы не палить механизм. См. §4b.
   */
  @IsOptional()
  @IsString()
  website?: string;
}
