import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function LkDashboardPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO title={t('pages.lk.title')} description={t('pages.lk.title')} path="/lk" noindex />
      <PageStub title={t('pages.lk.title')} note={t('pages.lk.stubNote')} />
    </>
  );
}
