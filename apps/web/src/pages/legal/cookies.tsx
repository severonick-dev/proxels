import { useTranslation } from 'react-i18next';
import { LegalDocPage } from '@/components/legal/legal-doc-page';

export default function CookiesPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <LegalDocPage slug="cookie" path="/legal/cookies" seoDescription={t('seo.legal.cookies')} />
  );
}
