import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.auth.login.title')}
        description={t('pages.auth.login.title')}
        path="/auth/login"
        noindex
      />
      <PageStub title={t('pages.auth.login.title')} note={t('pages.auth.login.stubNote')} />
    </>
  );
}
