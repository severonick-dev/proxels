import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function VerifyEmailPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.auth.verify.title')} note={t('pages.auth.verify.stubNote')} />;
}
