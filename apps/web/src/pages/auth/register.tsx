import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function RegisterPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.auth.register.title')}
        description={t('pages.auth.register.title')}
        path="/auth/register"
        noindex
      />
      <PageStub title={t('pages.auth.register.title')} note={t('pages.auth.register.stubNote')} />
    </>
  );
}
