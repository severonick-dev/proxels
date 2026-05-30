import { useTranslation } from 'react-i18next';
import { SEO, faqJsonLd } from '@/components/seo/seo';
import { Hero } from '@/components/sections/hero';
import { Benefits } from '@/components/sections/benefits';
import { HowItWorks } from '@/components/sections/how-it-works';
import { PricingPreview } from '@/components/sections/pricing-preview';
import { SupportedApps } from '@/components/sections/supported-apps';
import { Faq, useFaqItemsForJsonLd } from '@/components/sections/faq';

export default function HomePage(): JSX.Element {
  const { t } = useTranslation();
  const faqItems = useFaqItemsForJsonLd();

  return (
    <>
      <SEO
        title={t('seo.home.title')}
        description={t('seo.home.description')}
        path="/"
        jsonLd={faqJsonLd(faqItems)}
      />

      <Hero />
      <Benefits />
      <HowItWorks />
      <PricingPreview />
      <SupportedApps />
      <Faq />
    </>
  );
}
