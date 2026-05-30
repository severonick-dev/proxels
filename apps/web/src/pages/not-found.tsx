import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export default function NotFoundPage(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <span className="text-gradient font-display text-7xl font-bold tracking-tighter">404</span>
      <h1 className="mt-4 text-2xl font-semibold">{t('pages.notFound.title')}</h1>
      <p className="mt-2 max-w-md text-muted-foreground">{t('pages.notFound.subtitle')}</p>
      <Button asChild className="mt-6" variant="outline">
        <Link to="/">{t('pages.notFound.back')}</Link>
      </Button>
    </section>
  );
}
