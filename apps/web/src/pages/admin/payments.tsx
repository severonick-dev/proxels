import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

// API admin /payments endpoint не реализован отдельно — используем тот факт, что
// /api/payments/me с access-токеном админа возвращает только его собственные.
// Реальный admin /payments list с фильтрами — TODO в следующей итерации.
// Сейчас страница — карта-ссылка на AuditLog с фильтром action=payment.* как ближайший аналог.
interface AuditList {
  total: number;
  items: { id: string; action: string; meta: unknown; createdAt: string }[];
}

const STATUS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  succeeded: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  canceled: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function AdminPaymentsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(0);
  const take = 50;

  const auditQ = useQuery({
    queryKey: ['admin', 'audit', 'payment', page],
    queryFn: () =>
      apiRequest<AuditList>(`/admin/audit?take=${take}&skip=${page * take}&action=payment`),
  });

  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('admin.payments.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.payments.subtitle')}</p>
      </header>

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
                <th className="px-4 py-3 font-medium">{t('admin.payments.cols.amount')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.payments.cols.id')}</th>
              </tr>
            </thead>
            <tbody>
              {auditQ.data?.items.map((a) => {
                const meta = (a.meta ?? {}) as { amountRub?: number; paymentId?: string };
                const statusKey = a.action.split('.').pop() ?? a.action;
                return (
                  <tr key={a.id} className="border-b border-border/60 last:border-b-0 align-top">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString(locale)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-xs font-medium',
                          STATUS[statusKey] ?? 'border-border bg-secondary text-muted-foreground',
                        )}
                      >
                        {a.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{meta.amountRub ? `${meta.amountRub} ₽` : '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {meta.paymentId ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-2">
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
    </>
  );
}
