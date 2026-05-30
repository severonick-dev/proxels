import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function PrivacyPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageStub title={t('pages.legal.privacy.title')} note={t('pages.legal.privacy.stubNote')} />
  );
}
