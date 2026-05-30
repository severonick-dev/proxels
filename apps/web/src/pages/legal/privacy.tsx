import { useTranslation } from 'react-i18next';
import { LegalDocPage } from '@/components/legal/legal-doc-page';

export default function PrivacyPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <LegalDocPage slug="privacy" path="/legal/privacy" seoDescription={t('seo.legal.privacy')} />
  );
}
