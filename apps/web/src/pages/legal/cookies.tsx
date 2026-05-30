import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function CookiesPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.legal.cookies.title')}
        description={t('seo.legal.cookies')}
        path="/legal/cookies"
      />
      <PageStub title={t('pages.legal.cookies.title')} note={t('pages.legal.cookies.stubNote')} />
    </>
  );
}
