import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

interface NewsRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
}

export default function NewsIndexPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['news', 'list'],
    queryFn: () => apiRequest<NewsRow[]>('/news', { auth: false, skipCredentials: true }),
    staleTime: 60_000,
  });
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <SEO
        title={t('pages.news.seoTitle')}
        description={t('pages.news.seoDescription')}
        path="/news"
      />
      <section className="container mx-auto max-w-3xl py-12 md:py-20">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            {t('pages.news.title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('pages.news.subtitle')}</p>
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
          </div>
        )}

        {!isLoading && data && data.length === 0 && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t('pages.news.empty')}
          </div>
        )}

        <div className="space-y-4">
          {data?.map((n) => (
            <Link
              key={n.id}
              to={`/news/${n.slug}`}
              className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-accent/40"
            >
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {new Date(n.publishedAt).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
              <h2 className="mt-1 font-display text-xl font-semibold">{n.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{n.summary}</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
