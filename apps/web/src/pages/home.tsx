import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router-dom';
import { SEO, faqJsonLd } from '@/components/seo/seo';
import { Hero } from '@/components/sections/hero';
import { PlatformPicker } from '@/components/sections/platform-picker';
import { Benefits } from '@/components/sections/benefits';
import { HowItWorks } from '@/components/sections/how-it-works';
import { PricingPreview } from '@/components/sections/pricing-preview';
import { SupportedApps } from '@/components/sections/supported-apps';
import { Faq, useFaqItemsForJsonLd } from '@/components/sections/faq';
import { useAuthStore } from '@/stores/auth-store';

export default function HomePage(): JSX.Element {
  const { t } = useTranslation();
  const faqItems = useFaqItemsForJsonLd();
  const status = useAuthStore((s) => s.status);

  // Авторизованных уводим на ленту новостей — у них больше нет повода
  // смотреть лендинг каждый раз. Анонимам и пока bootstrap идёт — показываем
  // лендинг как обычно.
  if (status === 'auth') {
    return <Navigate to="/news" replace />;
  }

  return (
    <>
      <SEO
        title={t('seo.home.title')}
        description={t('seo.home.description')}
        path="/"
        jsonLd={faqJsonLd(faqItems)}
      />

      <Hero />
      <PlatformPicker />
      <Benefits />
      <HowItWorks />
      <PricingPreview />
      <SupportedApps />
      <Faq />
    </>
  );
}
