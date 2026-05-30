import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function VerifyEmailPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.auth.verify.title')}
        description={t('pages.auth.verify.title')}
        path="/auth/verify-email"
        noindex
      />
      <PageStub title={t('pages.auth.verify.title')} note={t('pages.auth.verify.stubNote')} />
    </>
  );
}
