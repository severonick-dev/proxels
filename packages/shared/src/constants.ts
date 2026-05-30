export const BRAND = {
  name: 'Proxels',
  domain: 'proxels.ru',
  telegramUrl: 'https://t.me/proxels',
  telegramHandle: '@proxels',
} as const;

export const SUB_TOKEN_BYTES = 32;
export const SUB_TOKEN_ENDPOINT = '/api/sub';

/**
 * Версии юр.документов. Пока хардкод; на Этапе 9 переедет в LegalDoc-таблицу
 * и будет подтягиваться из БД на момент согласия.
 *
 * При обновлении версии — bump-нуть значение и обновить контент в БД, чтобы
 * существующие пользователи попросили заново согласиться (UI Этапа 8/9).
 */
export const CONSENT_VERSIONS = {
  privacy: '2026-05-30',
  offer: '2026-05-30',
  cookie: '2026-05-30',
} as const;

export const REFRESH_COOKIE_NAME = 'proxels_rt';
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const EMAIL_MAX_LENGTH = 254;
export const PASSWORD_RESET_TTL_MIN = 60;
