import { Equals, IsOptional, IsString, IsUrl, Length, MinLength } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  @MinLength(1)
  planId!: string;

  /**
   * Принятие публичной оферты (ст. 437 ГК, см. §4). Без true платёж не создаётся.
   * Версия оферты фиксируется на бэке (CONSENT_VERSIONS.offer).
   */
  @Equals(true, { message: 'Public offer must be accepted' })
  offerAccepted!: true;

  /**
   * URL для возврата пользователя после оплаты. Должен принадлежать нашему домену
   * (валидация — пока только IsUrl; whitelist по host добавим, когда заработает фронт).
   */
  @IsOptional()
  @IsUrl({ require_tld: false })
  returnUrl?: string;

  /**
   * Опциональный промокод. Валидируется и применяется в `PaymentsService.createForUser`.
   * Сохраняется в `Payment.metadata`, redemption пишется в Postgres-транзакции после
   * `payment.succeeded` webhook'а (см. `handleSucceeded`).
   */
  @IsOptional()
  @IsString()
  @Length(2, 32)
  promoCode?: string;
}
