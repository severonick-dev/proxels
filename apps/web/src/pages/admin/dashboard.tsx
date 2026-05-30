import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function AdminDashboardPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.admin.title')}
        description={t('pages.admin.title')}
        path="/admin"
        noindex
      />
      <PageStub title={t('pages.admin.title')} note={t('pages.admin.stubNote')} />
    </>
  );
}
