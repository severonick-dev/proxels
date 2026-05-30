import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';
import { SEO, breadcrumbJsonLd } from '@/components/seo/seo';

export default function GuidesPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <SEO
        title={t('seo.guides.title')}
        description={t('seo.guides.description')}
        path="/guides"
        jsonLd={breadcrumbJsonLd([
          { name: 'Proxels', url: '/' },
          { name: t('seo.guides.title'), url: '/guides' },
        ])}
      />
      <PageStub
        title={t('pages.guides.title')}
        subtitle={t('pages.guides.subtitle')}
        note={t('pages.guides.stubNote')}
      />
    </>
  );
}
