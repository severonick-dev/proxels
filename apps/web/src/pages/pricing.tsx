import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SEO, productJsonLd } from '@/components/seo/seo';
import { PricingPreview, type ApiPlan } from '@/components/sections/pricing-preview';

export default function PricingPage(): JSX.Element {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<ApiPlan[]>([]);

  return (
    <>
      <SEO
        title={t('seo.pricing.title')}
        description={t('seo.pricing.description')}
        path="/pricing"
        jsonLd={
          plans.length > 0
            ? productJsonLd(
                plans.map((p) => ({
                  id: p.id,
                  name: p.name,
                  priceRub: p.priceRub,
                  durationDays: p.durationDays,
                })),
              )
            : undefined
        }
      />
      <PricingPreview onLoad={setPlans} />
    </>
  );
}
