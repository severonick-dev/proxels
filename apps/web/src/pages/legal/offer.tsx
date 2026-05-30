import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function OfferPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.legal.offer.title')} note={t('pages.legal.offer.stubNote')} />;
}
