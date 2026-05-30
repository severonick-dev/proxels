import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO } from '@/components/seo/seo';

export default function PrivacyPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('pages.legal.privacy.title')}
        description={t('seo.legal.privacy')}
        path="/legal/privacy"
      />
      <PageStub title={t('pages.legal.privacy.title')} note={t('pages.legal.privacy.stubNote')} />
    </>
  );
}
