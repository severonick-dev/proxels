import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function OfferPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.legal.offer.title')}
        description={t('seo.legal.offer')}
        path="/legal/offer"
      />
      <PageStub title={t('pages.legal.offer.title')} note={t('pages.legal.offer.stubNote')} />
    </>
  );
}
