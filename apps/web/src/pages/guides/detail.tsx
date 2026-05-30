import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Loader2, MessageCircle } from 'lucide-react';
import { SEO, breadcrumbJsonLd } from '@/components/seo/seo';
import { Markdown } from '@/components/markdown';
import { apiRequest, ApiError } from '@/lib/api';
import { usePublicConfig } from '@/hooks/use-public-config';

interface ApiGuide {
  id: string;
  slug: string;
  title: string;
  platforms: string;
  contentMd: string;
}

export default function GuideDetailPage(): JSX.Element {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const config = usePublicConfig();
  const { data, isLoading, error } = useQuery({
    queryKey: ['guides', slug],
    queryFn: () => apiRequest<ApiGuide>(`/guides/${slug}`, { auth: false, skipCredentials: true }),
    staleTime: 60 * 60 * 1000,
    enabled: !!slug,
  });

  const notFound = error instanceof ApiError && error.status === 404;
  const title = data?.title ?? t('pages.guides.title');

  return (
    <>
      <SEO
        title={title}
        description={data?.platforms ?? t('seo.guides.description')}
        path={`/guides/${slug ?? ''}`}
        jsonLd={breadcrumbJsonLd([
          { name: 'Proxels', url: '/' },
          { name: t('pages.guides.title'), url: '/guides' },
          { name: title, url: `/guides/${slug ?? ''}` },
        ])}
      />

      <article className="container mx-auto max-w-3xl py-12 md:py-20">
        <Link
          to="/guides"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {t('pages.guides.backToList')}
        </Link>

        {isLoading && (
          <div className="mt-8 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
          </div>
        )}

        {notFound && (
          <div className="mt-8 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            {t('pages.guides.notFound')}
          </div>
        )}

        {data && (
          <>
            <header className="mb-6 mt-6 border-b border-border pb-6">
              <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
                {data.title}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{data.platforms}</p>
            </header>
            <Markdown content={data.contentMd} />

            <div className="mt-12 grid gap-3 rounded-2xl border border-border bg-card p-5 md:grid-cols-2">
              <Link
                to="/guides"
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <div>
                  <div className="text-sm font-medium">{t('pages.guides.didntHelp.title')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('pages.guides.didntHelp.body')}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href={config.data?.brand.telegramUrl ?? 'https://t.me/proxels'}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <MessageCircle className="h-3.5 w-3.5 text-primary" />
                    {t('pages.guides.support.title')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {config.data?.brand.telegramHandle ?? '@proxels'}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </>
        )}
      </article>
    </>
  );
}
