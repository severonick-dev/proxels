import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { CAPTCHA_PROVIDER_TOKEN, type CaptchaProvider } from './captcha.types.js';

@Injectable()
export class CaptchaService {
  constructor(@Inject(CAPTCHA_PROVIDER_TOKEN) private readonly provider: CaptchaProvider) {}

  /**
   * Проверить капчу и бросить 400, если она не прошла.
   * Используется в auth-сервисах перед основной операцией.
   */
  async assertHuman(token: string, ip?: string): Promise<void> {
    const ok = await this.provider.verify(token, ip);
    if (!ok) {
      throw new BadRequestException('Captcha verification failed');
    }
  }
}
