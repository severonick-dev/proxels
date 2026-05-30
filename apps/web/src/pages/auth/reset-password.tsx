import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function ResetPasswordPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.auth.reset.title')}
        description={t('pages.auth.reset.title')}
        path="/auth/reset-password"
        noindex
      />
      <PageStub title={t('pages.auth.reset.title')} note={t('pages.auth.reset.stubNote')} />
    </>
  );
}
