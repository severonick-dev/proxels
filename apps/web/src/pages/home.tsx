import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HomePage(): JSX.Element {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden">
      <div className="container py-20 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            VLESS · Reality · ЮKassa · Россия
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-balance md:text-6xl">
            {t('pages.home.title')}{' '}
            <span className="text-gradient">{t('pages.home.titleAccent')}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg">
            {t('pages.home.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="gradient" size="lg">
              <Link to="/auth/register">
                {t('pages.home.ctaTry')} <ArrowRight className="ml-0.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/pricing">{t('pages.home.ctaPricing')}</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/70">{t('pages.home.stubNote')}</p>
        </div>
      </div>
    </section>
  );
}
