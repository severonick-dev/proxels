import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function LkDashboardPage(): JSX.Element {
  const { t } = useTranslation();
  return <PageStub title={t('pages.lk.title')} note={t('pages.lk.stubNote')} />;
}
