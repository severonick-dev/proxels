import { IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '@proxels/shared';

/**
 * Удаление аккаунта требует ввод текущего пароля — защита от случайной кнопки
 * и от XSS-перехвата сессии (если только access-токен украден, пароля у атакующего нет).
 */
export class DeleteAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;
}
