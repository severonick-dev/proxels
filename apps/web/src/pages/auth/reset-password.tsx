import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function ResetPasswordPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.auth.reset.title')} note={t('pages.auth.reset.stubNote')} />;
}
