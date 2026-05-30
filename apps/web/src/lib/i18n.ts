import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import ruCommon from '../i18n/locales/ru/common.json';
import enCommon from '../i18n/locales/en/common.json';

export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const LS_KEY = 'proxels:locale';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { common: ruCommon },
      en: { common: enCommon },
    },
    fallbackLng: 'ru',
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: ['common'],
    interpolation: { escapeValue: false },
    detection: {
      // Порядок: localStorage → язык браузера → дефолт ru.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LS_KEY,
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false,
    },
  });

// Синхронизируем <html lang="...">, чтобы скринридеры/SEO видели реальный язык.
i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('lang', lng);
  }
});

export default i18n;

export function changeLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
}
