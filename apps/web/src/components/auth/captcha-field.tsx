import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

interface Props {
  onChange: (token: string | null) => void;
  error?: string;
}

/**
 * Captcha-поле. В dev (VITE_CAPTCHA_PROVIDER=none или не задан) — рендерим badge
 * "DEV NOOP" и сразу эмитим строку "noop-dev" (backend NoopProvider принимает
 * любой непустой токен).
 *
 * В production — должен быть рендеринг Yandex SmartCaptcha widget (подключается
 * в head через <script src="https://smartcaptcha.yandexcloud.net/captcha.js?...">
 * и колбэк на window). Пока заглушка с TODO — нужный sitekey появится при
 * деплое (env VITE_CAPTCHA_SITE_KEY).
 */
export function CaptchaField({ onChange, error }: Props): JSX.Element {
  const { t } = useTranslation();
  const provider = (import.meta.env.VITE_CAPTCHA_PROVIDER ?? 'none') as
    | 'none'
    | 'yandex'
    | 'hcaptcha';
  const [acked, setAcked] = useState(false);

  useEffect(() => {
    if (provider === 'none') {
      onChange('noop-dev');
      setAcked(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  if (provider === 'none') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
        <span>
          <span className="font-mono">CAPTCHA: dev noop</span> · {t('forms.captcha.devNote')}
        </span>
      </div>
    );
  }

  // Production: TODO — реальный виджет Yandex SmartCaptcha.
  // Пока показываем заглушку, чтобы не падало.
  return (
    <div className="space-y-1.5">
      <div className="rounded-md border border-border bg-card p-3 text-xs text-muted-foreground">
        TODO: Yandex SmartCaptcha widget (provider={provider}, sitekey=
        {import.meta.env.VITE_CAPTCHA_SITE_KEY ?? '—'})
        <br />
        <button
          type="button"
          className="mt-2 text-primary underline"
          onClick={() => {
            onChange('dev-stub-token');
            setAcked(true);
          }}
        >
          Mark passed (dev override)
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {acked && <p className="text-xs text-muted-foreground">OK</p>}
    </div>
  );
}
