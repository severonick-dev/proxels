import { Logger } from '@nestjs/common';
import type { CaptchaProvider } from '../captcha.types.js';

const ENDPOINT = 'https://hcaptcha.com/siteverify';

/**
 * hCaptcha provider. Альтернатива Yandex SmartCaptcha.
 * Docs: https://docs.hcaptcha.com/#verify-the-user-response-server-side
 */
export class HCaptchaProvider implements CaptchaProvider {
  private readonly log = new Logger('HCaptcha');

  constructor(private readonly serverKey: string) {}

  async verify(token: string, ip?: string): Promise<boolean> {
    if (!token) return false;

    const body = new URLSearchParams({
      secret: this.serverKey,
      response: token,
      ...(ip ? { remoteip: ip } : {}),
    });

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) {
        this.log.warn(`hCaptcha returned HTTP ${res.status}`);
        return false;
      }
      const data = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
      const ok = data.success === true;
      if (!ok) {
        this.log.warn(`hCaptcha rejected: ${data['error-codes']?.join(',') ?? 'unknown'}`);
      }
      return ok;
    } catch (err) {
      this.log.error(`hCaptcha error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
