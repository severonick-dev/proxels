import { useTranslation } from 'react-i18next';
import { PageStub } from '@/components/layout/page-stub';

export default function GuidesPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <PageStub
      title={t('pages.guides.title')}
      subtitle={t('pages.guides.subtitle')}
      note={t('pages.guides.stubNote')}
    />
  );
}
