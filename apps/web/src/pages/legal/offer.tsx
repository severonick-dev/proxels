import { useTranslation } from 'react-i18next';
import { LegalDocPage } from '@/components/legal/legal-doc-page';

export default function OfferPage(): JSX.Element {
  const { t } = useTranslation();
  return <LegalDocPage slug="offer" path="/legal/offer" seoDescription={t('seo.legal.offer')} />;
}
