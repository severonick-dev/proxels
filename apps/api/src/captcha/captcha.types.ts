export interface CaptchaProvider {
  /**
   * Проверить токен капчи.
   * @returns true, если человек; false иначе.
   */
  verify(token: string, ip?: string): Promise<boolean>;
}

export const CAPTCHA_PROVIDER_TOKEN = Symbol('CAPTCHA_PROVIDER_TOKEN');
