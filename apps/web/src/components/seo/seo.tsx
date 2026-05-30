import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { BRAND } from '@proxels/shared';

interface Props {
  /** Только содержимое title; суффикс «— Proxels» добавляется автоматически (если не корень). */
  title: string;
  description: string;
  /** Относительный путь от корня сайта, без origin. */
  path?: string;
  /** Картинка для og:image (абсолютный путь от корня). По умолчанию /og-image.svg. */
  ogImage?: string;
  /** Если true — добавляем `noindex,nofollow`. Используем для /lk, /admin, 404. */
  noindex?: boolean;
  /** Опциональный JSON-LD payload (объект, серилизуется внутри). */
  jsonLd?: object | object[];
  /** Если этот заголовок уже включает бренд — не добавляем суффикс. */
  rawTitle?: boolean;
}

const SITE_ORIGIN = 'https://proxels.ru';

export function SEO({
  title,
  description,
  path = '',
  ogImage = '/og-image.svg',
  noindex,
  jsonLd,
  rawTitle,
}: Props): JSX.Element {
  const { i18n } = useTranslation();
  const lang = (i18n.resolvedLanguage ?? 'ru') as 'ru' | 'en';
  const fullTitle = rawTitle ? title : `${title} — ${BRAND.name}`;
  const canonical = `${SITE_ORIGIN}${path || '/'}`;
  const ogAbsolute = ogImage.startsWith('http') ? ogImage : `${SITE_ORIGIN}${ogImage}`;
  const jsonLdArray = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];

  return (
    <Helmet>
      <html lang={lang} />
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonical} />

      {/* hreflang: на этом этапе ru/en на одном URL (через переключатель),
          поэтому оба указывают на тот же canonical. Когда добавим /en/ URL — обновим. */}
      <link rel="alternate" hrefLang="ru" href={canonical} />
      <link rel="alternate" hrefLang="en" href={canonical} />
      <link rel="alternate" hrefLang="x-default" href={canonical} />

      {/* OG */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={BRAND.name} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogAbsolute} />
      <meta property="og:locale" content={lang === 'ru' ? 'ru_RU' : 'en_US'} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogAbsolute} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}

      {jsonLdArray.map((data, idx) => (
        <script key={idx} type="application/ld+json">
          {JSON.stringify(data)}
        </script>
      ))}
    </Helmet>
  );
}

/* ----- Helpers для типовых JSON-LD объектов ---------------------------- */

export function organizationJsonLd(): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND.name,
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.svg`,
    sameAs: [BRAND.telegramUrl],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        url: BRAND.telegramUrl,
        availableLanguage: ['Russian', 'English'],
      },
    ],
  };
}

export interface FaqItem {
  q: string;
  a: string;
}

export function faqJsonLd(items: FaqItem[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: it.a,
      },
    })),
  };
}

export interface PlanForLd {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
}

export function productJsonLd(plans: PlanForLd[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${BRAND.name} VPN`,
    description:
      'VPN-сервис на собственной инфраструктуре Xray (VLESS Reality). Подписка с автогенерацией ссылки.',
    brand: { '@type': 'Brand', name: BRAND.name },
    image: `${SITE_ORIGIN}/og-image.svg`,
    offers: plans.map((p) => ({
      '@type': 'Offer',
      sku: p.id,
      name: p.name,
      url: `${SITE_ORIGIN}/pricing`,
      price: p.priceRub.toFixed(2),
      priceCurrency: 'RUB',
      availability: 'https://schema.org/InStock',
      eligibleDuration: {
        '@type': 'QuantitativeValue',
        value: p.durationDays,
        unitCode: 'DAY',
      },
    })),
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: `${SITE_ORIGIN}${it.url}`,
    })),
  };
}

export { SITE_ORIGIN };
