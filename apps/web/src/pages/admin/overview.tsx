import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, Loader2, Server, Users } from 'lucide-react';
import { apiRequest } from '@/lib/api';

interface UsersList {
  total: number;
  items: { id: string; email: string; createdAt: string }[];
}
interface HealthRes {
  onlineCount: number;
  nodes: { id: string; status: string }[];
}
interface AuditList {
  total: number;
  items: { id: string; action: string; createdAt: string }[];
}

export default function AdminOverviewPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? 'ru';

  const usersQ = useQuery({
    queryKey: ['admin', 'users-count'],
    queryFn: () => apiRequest<UsersList>('/admin/users?take=1'),
  });
  const healthQ = useQuery({
    queryKey: ['admin', 'nodes-health'],
    queryFn: () => apiRequest<HealthRes>('/admin/nodes/health'),
    refetchInterval: 15_000,
  });
  const auditQ = useQuery({
    queryKey: ['admin', 'audit-recent'],
    queryFn: () => apiRequest<AuditList>('/admin/audit?take=15'),
  });

  return (
    <>
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('admin.overview.title')}
        </h1>
      </header>

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          Icon={Users}
          label={t('admin.overview.usersTotal')}
          value={usersQ.data?.total}
          loading={usersQ.isLoading}
        />
        <StatCard
          Icon={Server}
          label={t('admin.overview.nodesOnline')}
          value={
            healthQ.data ? `${healthQ.data.onlineCount} / ${healthQ.data.nodes.length}` : undefined
          }
          loading={healthQ.isLoading}
        />
        <StatCard
          Icon={CreditCard}
          label={t('admin.overview.auditTotal')}
          value={auditQ.data?.total}
          loading={auditQ.isLoading}
        />
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">{t('admin.overview.recentAudit')}</h2>
        {auditQ.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
          </div>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {auditQ.data?.items.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2">
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(a.createdAt).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatCard({
  Icon,
  label,
  value,
  loading,
}: {
  Icon: typeof Users;
  label: string;
  value?: string | number;
  loading: boolean;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" />
        {label}
      </div>
      <div className="mt-2 font-display text-3xl font-bold">
        {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (value ?? '—')}
      </div>
    </div>
  );
}
