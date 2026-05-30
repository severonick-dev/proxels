import { useEffect } from 'react';

interface Props {
  onChange: (token: string | null) => void;
  error?: string;
}

/**
 * Captcha-поле. Когда `VITE_CAPTCHA_PROVIDER=none` (dev / staging) — не рендерим
 * ничего и сразу эмитим бесшумный токен, который примет NoopProvider на бэке.
 * Никаких видимых dev-плашек — нечего показывать обычному пользователю.
 *
 * В production будет реальный виджет Yandex SmartCaptcha (подключается через
 * `<script src="https://smartcaptcha.yandexcloud.net/captcha.js?...">` + колбэк
 * на window). Здесь будет полноценная вставка, когда появится sitekey.
 */
export function CaptchaField({ onChange }: Props): JSX.Element | null {
  const provider = (import.meta.env.VITE_CAPTCHA_PROVIDER ?? 'none') as
    | 'none'
    | 'yandex'
    | 'hcaptcha';

  useEffect(() => {
    if (provider === 'none') {
      onChange('noop-dev');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  return null;
}
