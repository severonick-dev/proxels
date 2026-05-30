import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ApiLegalDoc {
  id: string;
  slug: 'privacy' | 'offer' | 'cookie';
  title: string;
  version: string;
  publishedAt: string | null;
  updatedAt: string;
}

export default function AdminLegalPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'legal'],
    queryFn: () => apiRequest<ApiLegalDoc[]>('/admin/legal'),
  });
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('admin.legal.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.legal.subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">{t('admin.legal.cols.title')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.legal.cols.version')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.legal.cols.published')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.legal.cols.updated')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.legal.cols.preview')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((d) => (
                <tr key={d.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{d.slug}</td>
                  <td className="px-4 py-2.5">{d.title}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{d.version}</td>
                  <td className="px-4 py-2.5">
                    {d.publishedAt ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(d.updatedAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/legal/${d.slug === 'cookie' ? 'cookies' : d.slug}`}
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      {t('admin.legal.preview')} ↗
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
