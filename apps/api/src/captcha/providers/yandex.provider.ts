import { Logger } from '@nestjs/common';
import type { CaptchaProvider } from '../captcha.types.js';

const ENDPOINT = 'https://smartcaptcha.yandexcloud.net/validate';

/**
 * Yandex SmartCaptcha. Актуально для РФ (не блокируется).
 * Docs: https://yandex.cloud/ru/docs/smartcaptcha/concepts/validation
 */
export class YandexCaptchaProvider implements CaptchaProvider {
  private readonly log = new Logger('YandexCaptcha');

  constructor(private readonly serverKey: string) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    if (!token) return false;

    const params = new URLSearchParams({
      secret: this.serverKey,
      token,
      ...(ip ? { ip } : {}),
    });

    try {
      const res = await fetch(`${ENDPOINT}?${params.toString()}`, {
        method: 'GET',
        // Yandex's validate API таймаут на их стороне; на нашей — короткий abort.
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        this.log.warn(`Yandex captcha returned HTTP ${res.status}`);
        return false;
      }
      const body = (await res.json()) as { status?: string; message?: string };
      const ok = body.status === 'ok';
      if (!ok) {
        this.log.warn(`Yandex captcha rejected token: ${body.message ?? 'unknown reason'}`);
      }
      return ok;
    } catch (err) {
      this.log.error(`Yandex captcha error: ${err instanceof Error ? err.message : String(err)}`);
      // При сетевой ошибке к капче — отказываем (fail-closed).
      return false;
    }
  }
}
