import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';

interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  ip: string | null;
  meta: unknown;
  createdAt: string;
}

interface AuditList {
  total: number;
  skip: number;
  take: number;
  items: AuditRow[];
}

export default function AdminAuditPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const take = 50;

  const auditQ = useQuery({
    queryKey: ['admin', 'audit', action, page],
    queryFn: () =>
      apiRequest<AuditList>(
        `/admin/audit?take=${take}&skip=${page * take}${action ? `&action=${encodeURIComponent(action)}` : ''}`,
      ),
  });

  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('admin.audit.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.audit.subtitle', { count: auditQ.data?.total ?? 0 })}
        </p>
      </header>

      <div className="mb-4">
        <Input
          placeholder={t('admin.audit.actionFilter')}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(0);
          }}
          className="max-w-sm"
        />
      </div>

      {auditQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.audit.cols.when')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.cols.action')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.audit.cols.actor')}</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Meta</th>
              </tr>
            </thead>
            <tbody>
              {auditQ.data?.items.map((a) => (
                <tr key={a.id} className="border-b border-border/60 last:border-b-0 align-top">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{a.action}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {a.actorId ? a.actorId.slice(0, 12) + '…' : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {a.ip ?? '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {a.meta ? (
                      <code className="break-all font-mono text-[11px] text-muted-foreground">
                        {JSON.stringify(a.meta)}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t('admin.audit.pageInfo', {
            from: page * take + 1,
            to: Math.min(page * take + take, auditQ.data?.total ?? 0),
            total: auditQ.data?.total ?? 0,
          })}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * take >= (auditQ.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>
    </>
  );
}
