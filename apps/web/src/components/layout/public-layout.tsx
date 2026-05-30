import { Outlet, ScrollRestoration } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Header } from './header';
import { Footer } from './footer';
import { organizationJsonLd } from '@/components/seo/seo';
import { CookieBanner } from '@/components/cookie-banner';
import { YandexMetrika } from '@/components/analytics/yandex-metrika';

/**
 * Organization JSON-LD рендерим один раз на уровне layout — он одинаков на всех
 * страницах. Per-page SEO (title, description, canonical, FAQPage/Product JSON-LD)
 * добавляется внутри страниц через <SEO />.
 *
 * CookieBanner + YandexMetrika находятся ВНУТРИ RouterProvider — им нужны
 * `useLocation` / `Link` из react-router.
 */
export function PublicLayout(): JSX.Element {
  return (
    <div className="flex min-h-dvh flex-col">
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(organizationJsonLd())}</script>
      </Helmet>

      <YandexMetrika />

      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />

      <CookieBanner />
      <ScrollRestoration />
    </div>
  );
}
