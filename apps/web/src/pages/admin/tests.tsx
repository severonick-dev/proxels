import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';

export default function AdminTestsPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('admin.tests.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.tests.subtitle')}</p>
      </header>

      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <FlaskConical className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-4 text-sm text-muted-foreground">{t('admin.tests.empty')}</p>
      </div>
    </>
  );
}
