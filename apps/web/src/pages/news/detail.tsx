import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SEO } from '@/components/seo/seo';
import { Markdown } from '@/components/markdown';
import { apiRequest, ApiError } from '@/lib/api';

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentMd: string;
  publishedAt: string;
}

export default function NewsDetailPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['news', 'detail', slug],
    queryFn: () => apiRequest<NewsPost>(`/news/${slug}`, { auth: false, skipCredentials: true }),
    staleTime: 60 * 60 * 1000,
    enabled: !!slug,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <SEO
        title={data?.title ?? t('pages.news.title')}
        description={data?.summary ?? t('pages.news.seoDescription')}
        path={`/news/${slug ?? ''}`}
      />

      <article className="container mx-auto max-w-3xl py-12 md:py-20">
        <Link
          to="/news"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('pages.news.back')}
        </Link>

        {isLoading && (
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
          </div>
        )}

        {notFound && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t('pages.news.notFound')}
          </div>
        )}

        {data && (
          <>
            <header className="mb-6 mt-6 border-b border-border pb-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {new Date(data.publishedAt).toLocaleDateString(locale, {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </div>
              <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
                {data.title}
              </h1>
              <p className="mt-2 text-muted-foreground">{data.summary}</p>
            </header>
            <Markdown content={data.contentMd} />
          </>
        )}
      </article>
    </>
  );
}
