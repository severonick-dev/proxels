import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Loader2, Smartphone } from 'lucide-react';
import { SEO, breadcrumbJsonLd } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface ApiGuide {
  id: string;
  slug: string;
  title: string;
  platforms: string;
  sortOrder: number;
}

export default function GuidesIndexPage(): JSX.Element {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['guides', 'list'],
    queryFn: () => apiRequest<ApiGuide[]>('/guides', { auth: false, skipCredentials: true }),
    staleTime: 60 * 60 * 1000,
  });

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

      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
            {t('pages.guides.title')}
          </h1>
          <p className="mt-3 text-muted-foreground">{t('pages.guides.subtitle')}</p>
        </div>

        <div className="mt-12">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
              {t('pages.guides.empty')}
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-3">
              {data.map((g) => (
                <Link
                  key={g.id}
                  id={g.slug}
                  to={`/guides/${g.slug}`}
                  className={cn(
                    'group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                      <Smartphone className="h-5 w-5" />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">{g.title}</h2>
                      <p className="text-xs text-muted-foreground">{g.platforms}</p>
                    </div>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    {t('pages.guides.open')}{' '}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
