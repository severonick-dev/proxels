import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function AdminDashboardPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.admin.title')} note={t('pages.admin.stubNote')} />;
}
