import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function RegisterPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageStub title={t('pages.auth.register.title')} note={t('pages.auth.register.stubNote')} />
  );
}
