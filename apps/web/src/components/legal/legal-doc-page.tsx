import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2 } from 'lucide-react';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

export type LegalSlug = 'privacy' | 'offer' | 'cookie';

export interface ApiLegalDoc {
  id: string;
  slug: LegalSlug;
  title: string;
  contentMd: string;
  version: string;
  publishedAt: string;
}

interface Props {
  slug: LegalSlug;
  /** URL path для canonical + SEO (например /legal/privacy). */
  path: string;
  /** Описание для <meta name="description">. */
  seoDescription: string;
}

/**
 * Универсальная страница юр.документа. Тянет контент из /api/legal/:slug,
 * рендерит markdown через react-markdown (внутри React-элементы, не innerHTML
 * — XSS-безопасно по дизайну).
 *
 * Версия и publishedAt показываются сверху — пользователю важно знать, какую
 * редакцию он принял.
 */
export function LegalDocPage({ slug, path, seoDescription }: Props): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['legal', slug],
    queryFn: () =>
      apiRequest<ApiLegalDoc>(`/legal/${slug}`, { auth: false, skipCredentials: true }),
    staleTime: 60 * 60 * 1000,
  });

  const title = data?.title ?? t(`pages.legal.${slug === 'cookie' ? 'cookies' : slug}.title`);
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <SEO title={title} description={seoDescription} path={path} />
      <article className="container mx-auto max-w-3xl py-12 md:py-20">
        <header className="mb-8 border-b border-border pb-6">
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          {data && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('legal.version', { version: data.version })}
              {' · '}
              {t('legal.publishedAt', {
                date: new Date(data.publishedAt).toLocaleDateString(locale),
              })}
            </p>
          )}
        </header>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <>
            <div className="mb-6 rounded-lg border border-dashed border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400/90">
              {t('legal.disclaimer')}
            </div>
            <div className="space-y-1 text-foreground/90">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: (props) => (
                    <h1 className="mb-4 mt-8 font-display text-2xl font-bold" {...props} />
                  ),
                  h2: (props) => (
                    <h2 className="mb-3 mt-7 font-display text-xl font-bold" {...props} />
                  ),
                  h3: (props) => <h3 className="mb-2 mt-5 text-lg font-semibold" {...props} />,
                  p: (props) => <p className="mb-4 leading-relaxed" {...props} />,
                  ul: (props) => <ul className="mb-4 list-disc space-y-1 pl-6" {...props} />,
                  ol: (props) => <ol className="mb-4 list-decimal space-y-1 pl-6" {...props} />,
                  li: (props) => <li className="leading-relaxed" {...props} />,
                  a: (props) => (
                    <a
                      {...props}
                      className="text-primary underline-offset-4 hover:underline"
                      target={props.href?.startsWith('http') ? '_blank' : undefined}
                      rel={props.href?.startsWith('http') ? 'noreferrer noopener' : undefined}
                    />
                  ),
                  strong: (props) => (
                    <strong className="font-semibold text-foreground" {...props} />
                  ),
                  code: (props) => (
                    <code
                      className="rounded bg-secondary px-1 py-0.5 font-mono text-xs"
                      {...props}
                    />
                  ),
                  blockquote: (props) => (
                    <blockquote
                      className="my-4 border-l-2 border-primary/40 pl-4 italic text-muted-foreground"
                      {...props}
                    />
                  ),
                  table: (props) => (
                    <div className="my-4 overflow-x-auto">
                      <table className="w-full border-collapse text-sm" {...props} />
                    </div>
                  ),
                  th: (props) => (
                    <th
                      className="border-b border-border bg-secondary/50 px-3 py-2 text-left font-semibold"
                      {...props}
                    />
                  ),
                  td: (props) => <td className="border-b border-border/60 px-3 py-2" {...props} />,
                  hr: () => <hr className="my-6 border-border" />,
                }}
              >
                {data.contentMd}
              </ReactMarkdown>
            </div>
          </>
        )}
      </article>
    </>
  );
}
