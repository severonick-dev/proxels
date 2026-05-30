import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface ApiPlan {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
  trafficLimitGb: number | null;
  sortOrder: number;
}

export default function PricingPage(): JSX.Element {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ApiPlan[]>('/plans', { signal: controller.signal, credentials: 'omit' })
      .then(setPlans)
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      });
    return () => controller.abort();
  }, []);

  const cheapest = plans && plans.length > 0 ? Math.min(...plans.map((p) => p.priceRub)) : null;

  return (
    <section className="container py-16 md:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">
          {t('pages.pricing.title')}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {t('pages.pricing.subtitle', { from: cheapest ?? '150' })}
        </p>
      </div>

      <div className="mt-10">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            {t('pages.pricing.error')} <span className="opacity-60">({error})</span>
          </div>
        ) : !plans ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t('pages.pricing.loading')}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                highlight={cheapest != null && p.priceRub === cheapest}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function PlanCard({
  plan,
  highlight,
  t,
}: {
  plan: ApiPlan;
  highlight: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}): JSX.Element {
  return (
    <article
      className={cn(
        'group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30',
        highlight && 'border-primary/40 shadow-[0_24px_80px_-30px_hsl(var(--primary)/0.5)]',
      )}
    >
      {highlight && (
        <span className="absolute -top-2.5 left-6 rounded-full bg-brand-gradient px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
          best
        </span>
      )}
      <div className="text-sm font-medium text-muted-foreground">{plan.name}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-bold">{plan.priceRub}</span>
        <span className="text-sm text-muted-foreground">₽</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {t('pages.pricing.perPeriod', { count: plan.durationDays })}
      </div>

      <ul className="mt-5 space-y-2 text-sm">
        <li className="flex items-start gap-2 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
          <span>
            {plan.trafficLimitGb ? `${plan.trafficLimitGb} GB` : t('pages.pricing.noTraffic')}
          </span>
        </li>
        <li className="flex items-start gap-2 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
          <span>VLESS · Reality · failover</span>
        </li>
      </ul>

      <Button asChild className="mt-auto" variant={highlight ? 'gradient' : 'outline'}>
        <a href={`/auth/register?plan=${plan.id}`}>{t('nav.register')}</a>
      </Button>
    </article>
  );
}
