import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface NodeHealth {
  consecutiveSuccess: number;
  consecutiveFailure: number;
  lastProbeAt: string;
  lastProbeOk: boolean;
}

interface NodeRow {
  id: string;
  name: string;
  host: string;
  port: number;
  country: string;
  xrayApiAddr: string;
  status: 'online' | 'offline' | 'degraded';
  isActive: boolean;
  weight: number;
  lastCheckAt: string | null;
  health: NodeHealth | null;
}

interface HealthRes {
  onlineCount: number;
  nodes: NodeRow[];
}

const STATUS_COLOR: Record<NodeRow['status'], string> = {
  online: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  offline: 'border-destructive/30 bg-destructive/10 text-destructive',
  degraded: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
};

export default function AdminNodesPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'nodes-health'],
    queryFn: () => apiRequest<HealthRes>('/admin/nodes/health'),
    refetchInterval: 10_000,
  });

  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('admin.nodes.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data
            ? t('admin.nodes.subtitle', {
                online: data.onlineCount,
                total: data.nodes.length,
              })
            : t('admin.nodes.subtitleLoading')}
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.name')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.host')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.status')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.weight')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.health')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.lastProbe')}</th>
              </tr>
            </thead>
            <tbody>
              {data?.nodes.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-b-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{n.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.country} · {n.xrayApiAddr}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {n.host}:{n.port}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        STATUS_COLOR[n.status],
                      )}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{n.weight}</td>
                  <td className="px-4 py-2.5">
                    {n.health ? (
                      <div className="flex items-center gap-2 text-xs">
                        {n.health.lastProbeOk ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className="text-muted-foreground">
                          ✓ {n.health.consecutiveSuccess} · ✗ {n.health.consecutiveFailure}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {n.lastCheckAt ? new Date(n.lastCheckAt).toLocaleString(locale) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 rounded-lg border border-dashed border-border bg-card/40 p-4 text-xs text-muted-foreground">
        {t('admin.nodes.crudNote')}
      </div>
    </>
  );
}
