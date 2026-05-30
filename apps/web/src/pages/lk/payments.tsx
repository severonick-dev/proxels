import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface PublicPayment {
  id: string;
  subscriptionId: string | null;
  amountRub: number;
  status: 'pending' | 'waiting_for_capture' | 'succeeded' | 'canceled';
  receiptSent: boolean;
  createdAt: string;
}

const STATUS_COLORS: Record<PublicPayment['status'], string> = {
  pending: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  waiting_for_capture: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30',
  succeeded: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  canceled: 'bg-destructive/15 text-destructive border-destructive/30',
};

export default function LkPaymentsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const { data, isLoading, error } = useQuery({
    queryKey: ['payments', 'me'],
    queryFn: () => apiRequest<PublicPayment[]>('/payments/me'),
  });

  return (
    <>
      <SEO
        title={t('lk.payments.title')}
        description={t('lk.payments.title')}
        path="/lk/payments"
        noindex
      />

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('lk.payments.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lk.payments.subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t('lk.payments.empty')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('lk.payments.cols.date')}</th>
                <th className="px-4 py-3 font-medium">{t('lk.payments.cols.amount')}</th>
                <th className="px-4 py-3 font-medium">{t('lk.payments.cols.status')}</th>
                <th className="px-4 py-3 font-medium">{t('lk.payments.cols.receipt')}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-border/70 last:border-b-0">
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString(i18n.resolvedLanguage ?? 'ru')}
                  </td>
                  <td className="px-4 py-3 font-medium">{p.amountRub} ₽</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        STATUS_COLORS[p.status],
                      )}
                    >
                      {t(`lk.payments.status.${p.status}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {p.receiptSent
                      ? t('lk.payments.receipt.sent')
                      : t('lk.payments.receipt.notYet')}
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
