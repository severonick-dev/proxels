import { Logger } from '@nestjs/common';
import type { CaptchaProvider } from '../captcha.types.js';

/**
 * Noop-провайдер для локальной разработки и тестов.
 * Всегда возвращает true. ЗАПРЕЩЕНО использовать в production — на старте
 * сервиса CaptchaService выкидывает ошибку, если NODE_ENV=production и провайдер=none.
 */
export class NoopCaptchaProvider implements CaptchaProvider {
  private readonly log = new Logger('NoopCaptcha');

  async verify(_token: string, _ip?: string): Promise<boolean> {
    this.log.debug('Skipping captcha verification (provider=none)');
    return true;
  }
}
