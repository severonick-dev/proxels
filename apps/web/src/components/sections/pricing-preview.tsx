import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { PurchaseDialog } from '@/components/lk/purchase-dialog';
import { cn } from '@/lib/cn';
import { SectionHeading } from './section-heading';

export interface ApiPlan {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
  trafficLimitGb: number | null;
  sortOrder: number;
}

interface Props {
  onLoad?: (plans: ApiPlan[]) => void;
}

export function PricingPreview({ onLoad }: Props): JSX.Element {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<ApiPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buyingPlan, setBuyingPlan] = useState<ApiPlan | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    apiRequest<ApiPlan[]>('/plans', { signal: ctl.signal, auth: false, skipCredentials: true })
      .then((data) => {
        setPlans(data);
        onLoad?.(data);
      })
      .catch((err) => {
        if ((err as Error).name === 'AbortError') return;
        setError((err as Error).message);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cheapest = plans && plans.length > 0 ? Math.min(...plans.map((p) => p.priceRub)) : null;

  // Динамический заголовок зависит от реального числа активных тарифов в БД.
  // Тексты вида "{{count}} уровень/уровня/уровней" в локали с pluralization-suffixes.
  const planCount = plans?.length ?? 0;

  return (
    <section className="container py-20 md:py-28">
      <SectionHeading
        eyebrow={t('pages.home.pricingPreview.eyebrow')}
        title={
          planCount > 0
            ? t('pages.home.pricingPreview.title', { count: planCount })
            : t('pages.home.pricingPreview.eyebrow')
        }
        subtitle={t('pages.home.pricingPreview.subtitle')}
      />

      <div className="mt-12">
        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center text-sm text-destructive">
            {t('pages.pricing.error')}
          </div>
        ) : !plans ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-sm text-muted-foreground">
            {t('pages.pricing.loading')}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p, idx) => (
              <PlanCard
                key={p.id}
                plan={p}
                highlight={p.priceRub > 0 && cheapest != null && p.priceRub === cheapest}
                idx={idx}
                t={t}
                onBuy={() => setBuyingPlan(p)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline">
          <Link to="/pricing">
            {t('pages.home.pricingPreview.cta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <PurchaseDialog
        plan={buyingPlan}
        onOpenChange={(open) => {
          if (!open) setBuyingPlan(null);
        }}
      />
    </section>
  );
}

interface CardProps {
  plan: ApiPlan;
  highlight: boolean;
  idx: number;
  t: (key: string, opts?: Record<string, unknown>) => string;
  onBuy: () => void;
}

function PlanCard({ plan, highlight, idx, t, onBuy }: CardProps): JSX.Element {
  const isAuthed = useAuthStore((s) => s.status === 'auth');
  const isFree = plan.priceRub === 0;

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.45, delay: idx * 0.06 }}
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
        {isFree
          ? t('pages.home.pricingPreview.freeNote', { count: plan.durationDays })
          : t('pages.home.pricingPreview.perDay', { count: plan.durationDays })}
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

      {/* Кнопка с отбивкой от features-листа + mt-auto чтобы прижать к низу карточки. */}
      <div className="mt-6 pt-2 flex-1 flex flex-col justify-end">
        {isAuthed ? (
          <Button onClick={onBuy} className="w-full" variant={highlight ? 'gradient' : 'outline'}>
            {isFree ? t('pages.home.pricingPreview.activate') : t('pages.home.pricingPreview.buy')}
          </Button>
        ) : (
          <Button asChild className="w-full" variant={highlight ? 'gradient' : 'outline'}>
            <Link to={`/auth/register?plan=${plan.id}`}>{t('nav.register')}</Link>
          </Button>
        )}
      </div>
    </motion.article>
  );
}
