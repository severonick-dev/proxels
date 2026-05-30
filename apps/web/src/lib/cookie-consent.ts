/**
 * Управление согласием на cookie (§4 CLAUDE.md).
 *
 * Хранится в localStorage. До явного решения — null (показываем баннер).
 * При обновлении кидаем кастомный event, чтобы YandexMetrika подгрузилась
 * без перезагрузки страницы.
 */

const KEY = 'proxels:cookie-consent';
const EVENT = 'proxels:consent-changed';

export interface CookieConsent {
  /** Всегда true — необходимые cookie ставятся в любом случае. */
  necessary: true;
  /** Аналитика (Yandex.Metrika). */
  analytics: boolean;
  /** ISO-дата решения. */
  decidedAt: string;
}

export function getConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CookieConsent>;
    if (parsed && parsed.necessary === true && typeof parsed.analytics === 'boolean') {
      return {
        necessary: true,
        analytics: parsed.analytics,
        decidedAt:
          typeof parsed.decidedAt === 'string' ? parsed.decidedAt : new Date().toISOString(),
      };
    }
  } catch {
    /* ignore corrupted JSON */
  }
  return null;
}

export function setConsent(analytics: boolean): CookieConsent {
  const consent: CookieConsent = {
    necessary: true,
    analytics,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(consent));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: consent }));
  return consent;
}

export function clearConsent(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: null }));
}

export function onConsentChange(handler: (c: CookieConsent | null) => void): () => void {
  const listener = (ev: Event) => {
    const detail = (ev as CustomEvent<CookieConsent | null>).detail ?? null;
    handler(detail);
  };
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

export const CONSENT_EVENT = EVENT;
