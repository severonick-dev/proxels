import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getConsent, onConsentChange } from '@/lib/cookie-consent';
import { usePublicConfig } from '@/hooks/use-public-config';

declare global {
  interface Window {
    ym?: (id: number, action: string, ...args: unknown[]) => void;
  }
}

const SCRIPT_URL = 'https://mc.yandex.ru/metrika/tag.js';

/**
 * Yandex.Metrika loader (§4c CLAUDE.md).
 *
 * Грузится ТОЛЬКО при выполнении ВСЕХ трёх условий:
 *  - пользователь явно согласился на аналитические cookie (см. CookieBanner);
 *  - в `/api/config/public` пришёл `analytics.yandexMetrikaId` (не задан в dev → null);
 *  - мы не в development NODE_ENV.
 *
 * Когда условия выполнены — инициализируется один раз и потом трекает каждый
 * route change через `ym(id, 'hit', url)`.
 */
export function YandexMetrika(): null {
  const { data: cfg } = usePublicConfig();
  const counterIdRaw = cfg?.analytics.yandexMetrikaId ?? null;
  const isDev = import.meta.env.DEV;

  const [analyticsAllowed, setAnalyticsAllowed] = useState<boolean>(
    () => getConsent()?.analytics === true,
  );

  useEffect(() => {
    return onConsentChange((c) => setAnalyticsAllowed(c?.analytics === true));
  }, []);

  // Init (single)
  useEffect(() => {
    if (!analyticsAllowed || !counterIdRaw || isDev) return;
    if (window.ym) return; // уже инициализирован

    // Подгружаем скрипт Метрики
    const counterId = Number(counterIdRaw);
    if (!Number.isFinite(counterId)) return;

    type Ym = ((id: number, action: string, ...args: unknown[]) => void) & {
      a?: unknown[];
      l?: number;
    };
    const wym = window as Window & { ym?: Ym };
    if (!wym.ym) {
      const ymStub = function (this: unknown, ...args: unknown[]) {
        (ymStub.a = ymStub.a ?? []).push(args);
      } as Ym;
      ymStub.l = Date.now();
      wym.ym = ymStub;
    }

    const existing = Array.from(document.scripts).find((s) => s.src === SCRIPT_URL);
    if (!existing) {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      document.head.appendChild(script);
    }

    window.ym!(counterId, 'init', {
      ssr: true,
      webvisor: false, // приватность важнее (см. §4a — никаких визорных кликов на чужих страницах)
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      defer: true,
    });
  }, [analyticsAllowed, counterIdRaw, isDev]);

  // Hit on route change
  const location = useLocation();
  useEffect(() => {
    if (!analyticsAllowed || !counterIdRaw || isDev) return;
    if (!window.ym) return;
    const counterId = Number(counterIdRaw);
    if (!Number.isFinite(counterId)) return;
    window.ym(counterId, 'hit', window.location.href, {
      title: document.title,
      referer: document.referrer,
    });
  }, [location.pathname, location.search, analyticsAllowed, counterIdRaw, isDev]);

  return null;
}
