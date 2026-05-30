import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface ApiGuide {
  id: string;
  slug: string;
  title: string;
  platforms: string;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}

export default function AdminGuidesPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'guides'],
    queryFn: () => apiRequest<ApiGuide[]>('/admin/guides'),
  });
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('admin.guides.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.guides.subtitle')}</p>
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
                <th className="px-4 py-3 font-medium">{t('admin.guides.cols.title')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.guides.cols.platforms')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.guides.cols.sort')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.guides.cols.published')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.guides.cols.preview')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((g) => (
                <tr key={g.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-2.5 font-mono text-xs">{g.slug}</td>
                  <td className="px-4 py-2.5">{g.title}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{g.platforms}</td>
                  <td className="px-4 py-2.5">{g.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    {g.isPublished ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      to={`/guides/${g.slug}`}
                      target="_blank"
                      className="text-primary hover:underline"
                    >
                      ↗
                    </Link>{' '}
                    <span className="text-xs text-muted-foreground">
                      · {new Date(g.updatedAt).toLocaleDateString(locale)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground">
        {t('admin.guides.editorNote')}
      </div>
    </>
  );
}
