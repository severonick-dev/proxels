import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function CookiesPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageStub title={t('pages.legal.cookies.title')} note={t('pages.legal.cookies.stubNote')} />
  );
}
