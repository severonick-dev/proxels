import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.auth.login.title')} note={t('pages.auth.login.stubNote')} />;
}
