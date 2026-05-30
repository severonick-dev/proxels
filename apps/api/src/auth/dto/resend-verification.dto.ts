import { IsEmail, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { EMAIL_MAX_LENGTH } from '@proxels/shared';

export class ResendVerificationDto {
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  captchaToken!: string;
}
