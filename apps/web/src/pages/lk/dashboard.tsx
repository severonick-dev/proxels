import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { ArrowRight, Copy, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface SubscriptionWithPlan {
  id: string;
  userId: string;
  planId: string;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  startAt: string | null;
  endAt: string | null;
  subToken: string;
  subTokenRotatedAt: string | null;
  trafficUsedBytes: string;
  plan: {
    id: string;
    name: string;
    priceRub: number;
    durationDays: number;
    trafficLimitGb: number | null;
  };
}

export default function LkDashboardPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();

  const {
    data: subs,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['subs', 'me'],
    queryFn: () => apiRequest<SubscriptionWithPlan[]>('/subscriptions/me'),
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/subscriptions/me/${id}/rotate-token`, { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subs', 'me'] });
      toast.success(t('lk.toast.subTokenRotated'));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const active = subs?.find(
    (s) => s.status === 'active' && s.endAt && new Date(s.endAt) > new Date(),
  );

  return (
    <>
      <SEO title={t('pages.lk.title')} description={t('pages.lk.title')} path="/lk" noindex />

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('lk.dashboard.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lk.dashboard.subtitle')}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(error as Error).message}
        </div>
      ) : !active ? (
        <NoSubscription t={t} />
      ) : (
        <ActiveSubscription
          sub={active}
          locale={i18n.resolvedLanguage ?? 'ru'}
          onRotate={() => rotateMutation.mutate(active.id)}
          rotating={rotateMutation.isPending}
          t={t}
        />
      )}
    </>
  );
}

function NoSubscription({ t }: { t: (k: string) => string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-display text-xl font-semibold">{t('lk.dashboard.noSub.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{t('lk.dashboard.noSub.body')}</p>
      <Button asChild variant="gradient" className="mt-5">
        <Link to="/pricing">
          {t('lk.dashboard.noSub.cta')} <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

interface ActiveProps {
  sub: SubscriptionWithPlan;
  locale: string;
  onRotate: () => void;
  rotating: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function ActiveSubscription({ sub, locale, onRotate, rotating, t }: ActiveProps): JSX.Element {
  const subUrl = buildSubUrl(sub.subToken);
  const endDate = sub.endAt ? new Date(sub.endAt) : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86_400_000))
    : 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subUrl);
      toast.success(t('lk.toast.copied'));
    } catch {
      toast.error(t('lk.toast.copyFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-3">
        <Stat label={t('lk.dashboard.stats.plan')} value={sub.plan.name} />
        <Stat
          label={t('lk.dashboard.stats.endAt')}
          value={endDate ? endDate.toLocaleDateString(locale) : '—'}
          hint={t('lk.dashboard.stats.daysLeft', { count: daysLeft })}
        />
        <Stat
          label={t('lk.dashboard.stats.traffic')}
          value={formatTraffic(sub.trafficUsedBytes)}
          hint={
            sub.plan.trafficLimitGb
              ? `${sub.plan.trafficLimitGb} GB ${t('lk.dashboard.stats.limit')}`
              : t('pages.pricing.noTraffic')
          }
        />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{t('lk.dashboard.link.title')}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{t('lk.dashboard.link.subtitle')}</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRotate} disabled={rotating}>
            {rotating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('lk.dashboard.link.rotate')}
          </Button>
        </div>

        <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_auto]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-md bg-secondary/60 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                subscription URL
              </div>
              <code className="mt-1 block break-all font-mono text-xs">{subUrl}</code>
            </div>
            <Button variant="outline" size="sm" onClick={copy} className="w-full sm:w-auto">
              <Copy className="h-4 w-4" /> {t('lk.dashboard.link.copy')}
            </Button>
            {sub.subTokenRotatedAt && (
              <p className="text-xs text-muted-foreground">
                {t('lk.dashboard.link.lastRotated', {
                  date: new Date(sub.subTokenRotatedAt).toLocaleString(locale),
                })}
              </p>
            )}
          </div>

          <div className={cn('flex shrink-0 items-center justify-center rounded-md bg-white p-3')}>
            <QRCodeSVG value={subUrl} size={144} marginSize={0} level="M" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function buildSubUrl(token: string): string {
  // Phase 10 поднимет /api/sub/:token endpoint. Сейчас формат уже правильный.
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://proxels.ru';
  return `${origin}/api/sub/${token}`;
}

function formatTraffic(bytesStr: string | number): string {
  const bytes = typeof bytesStr === 'string' ? Number(bytesStr) : bytesStr;
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}
