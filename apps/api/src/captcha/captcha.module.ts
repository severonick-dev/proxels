import { Global, Logger, Module, Provider } from '@nestjs/common';
import { EnvService } from '../config/env.service.js';
import { CaptchaService } from './captcha.service.js';
import { CAPTCHA_PROVIDER_TOKEN, type CaptchaProvider } from './captcha.types.js';
import { NoopCaptchaProvider } from './providers/noop.provider.js';
import { YandexCaptchaProvider } from './providers/yandex.provider.js';
import { HCaptchaProvider } from './providers/hcaptcha.provider.js';

const captchaProvider: Provider = {
  provide: CAPTCHA_PROVIDER_TOKEN,
  inject: [EnvService],
  useFactory: (env: EnvService): CaptchaProvider => {
    const log = new Logger('CaptchaFactory');
    const provider = env.get('CAPTCHA_PROVIDER');
    const serverKey = env.get('CAPTCHA_SERVER_KEY') ?? '';

    if (provider === 'none') {
      if (env.isProduction) {
        // Раньше тут был throw — но это блокирует первый MVP-запуск, когда
        // капчи ещё нет, а зарегистрироваться нужно (например, для Free-тарифа
        // без оплаты). Релакшу до жёсткого WARN — сервис стартует, но в логе
        // чётко видно, что антибот выключен.
        log.warn(
          '!!! CAPTCHA_PROVIDER=none in production. Antibot is OFF. Configure yandex or hcaptcha ASAP. !!!',
        );
      } else {
        log.warn('Captcha disabled (CAPTCHA_PROVIDER=none). DEV ONLY.');
      }
      return new NoopCaptchaProvider();
    }

    if (!serverKey) {
      throw new Error(`CAPTCHA_SERVER_KEY is required when CAPTCHA_PROVIDER=${provider}`);
    }

    if (provider === 'yandex') {
      log.log('Using Yandex SmartCaptcha provider');
      return new YandexCaptchaProvider(serverKey);
    }

    if (provider === 'hcaptcha') {
      log.log('Using hCaptcha provider');
      return new HCaptchaProvider(serverKey);
    }

    throw new Error(`Unknown CAPTCHA_PROVIDER: ${String(provider)}`);
  },
};

@Global()
@Module({
  providers: [captchaProvider, CaptchaService],
  exports: [CaptchaService],
})
export class CaptchaModule {}
