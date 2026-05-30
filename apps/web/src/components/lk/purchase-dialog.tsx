import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ApiError, apiRequest } from '@/lib/api';

interface PlanLite {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
}

interface CreatePaymentResponse {
  paymentId: string;
  confirmationUrl: string;
  bypassed: boolean;
  amountRub: number;
  discountRub: number;
}

interface PromoValidationResponse {
  ok: true;
  promoId: string;
  code: string;
  discountKind: 'percent' | 'fixedRub';
  discountValue: number;
  discountRub: number;
  finalAmountRub: number;
}

type PromoState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'ok'; data: PromoValidationResponse }
  | { status: 'error'; reason: string };

interface Props {
  plan: PlanLite | null;
  /** Контролируемое открытие. null плана = закрыто. */
  onOpenChange: (open: boolean) => void;
}

/**
 * Подтверждение покупки тарифа из ЛК (или с лендинга авторизованного юзера).
 *
 * Flow:
 *  1. Показываем план, цену, длительность, чекбокс согласия с офертой.
 *  2. По клику «Оплатить» → POST /api/payments/create.
 *  3. Если `bypassed: true` (dev) — сразу дёргаем dev/simulate-succeeded
 *     и шлём в /lk: «оплата засимулирована».
 *  4. Иначе — `window.location.href = confirmationUrl` (страница YooKassa).
 */
export function PurchaseDialog({ plan, onOpenChange }: Props): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [promoInput, setPromoInput] = useState('');
  const [promoState, setPromoState] = useState<PromoState>({ status: 'idle' });

  // Сброс состояния при смене плана/закрытии.
  useEffect(() => {
    if (!plan) {
      setAgreed(false);
      setPromoInput('');
      setPromoState({ status: 'idle' });
    }
  }, [plan]);

  // Debounced live-валидация: 350мс после остановки печати.
  useEffect(() => {
    if (!plan) return;
    const trimmed = promoInput.trim();
    if (trimmed.length < 2) {
      setPromoState({ status: 'idle' });
      return;
    }
    setPromoState({ status: 'checking' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      apiRequest<PromoValidationResponse>('/promos/validate', {
        method: 'POST',
        body: { code: trimmed, planId: plan.id },
        signal: ctrl.signal,
      })
        .then((data) => setPromoState({ status: 'ok', data }))
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          const reason = extractPromoErrorReason(err);
          setPromoState({ status: 'error', reason });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [promoInput, plan]);

  const effectivePromo = promoState.status === 'ok' ? promoState.data : null;
  const finalAmount = plan ? (effectivePromo?.finalAmountRub ?? plan.priceRub) : 0;
  const isFree = plan?.priceRub === 0;

  const handlePay = async () => {
    if (!plan) return;
    if (!agreed) {
      toast.error(t('purchase.errors.offerRequired'));
      return;
    }
    setSubmitting(true);
    try {
      // Free-тариф — отдельный путь без YooKassa.
      if (isFree) {
        await apiRequest('/subscriptions/activate-free', {
          method: 'POST',
          body: { planId: plan.id },
        });
        toast.success(t('purchase.toast.freeActivated'));
        onOpenChange(false);
        navigate('/lk', { replace: true });
        return;
      }

      const body: Record<string, unknown> = {
        planId: plan.id,
        offerAccepted: true,
      };
      if (effectivePromo) body.promoCode = effectivePromo.code;

      const res = await apiRequest<CreatePaymentResponse>('/payments/create', {
        method: 'POST',
        body,
      });

      if (res.bypassed) {
        await apiRequest(
          `/payments/dev/simulate-succeeded/${encodeURIComponent(extractYooId(res))}`,
          { method: 'POST' },
        ).catch(() => {
          /* лучшая попытка — если упал, юзер всё равно увидит pending в ЛК */
        });
        toast.success(t('purchase.toast.devSimulated'));
        onOpenChange(false);
        navigate('/lk', { replace: true });
        return;
      }

      window.location.href = res.confirmationUrl;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={plan !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {plan && (
          <>
            <div className="space-y-1.5">
              <DialogTitle>{t('purchase.title', { plan: plan.name })}</DialogTitle>
              <DialogDescription>
                {t('purchase.subtitle', { count: plan.durationDays })}
              </DialogDescription>
            </div>

            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('purchase.total')}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{finalAmount} ₽</span>
                {effectivePromo && (
                  <span className="text-sm text-muted-foreground line-through">
                    {plan.priceRub} ₽
                  </span>
                )}
              </div>
              {effectivePromo && (
                <div className="mt-1 text-xs text-emerald-500">
                  {t('purchase.promo.applied', {
                    code: effectivePromo.code,
                    discount: effectivePromo.discountRub,
                  })}
                </div>
              )}
            </div>

            {!isFree && (
              <div className="space-y-1.5">
                <label htmlFor="promo-code" className="text-sm font-medium">
                  {t('purchase.promo.label')}
                </label>
                <div className="relative">
                  <Input
                    id="promo-code"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    maxLength={32}
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                    placeholder={t('purchase.promo.placeholder')}
                    className="pr-10 uppercase placeholder:normal-case"
                    aria-invalid={promoState.status === 'error'}
                    disabled={submitting}
                  />
                  {promoState.status === 'checking' && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                  {promoState.status === 'ok' && (
                    <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
                {promoState.status === 'error' && (
                  <div className="text-xs text-destructive">
                    {t(`purchase.promo.errors.${promoState.reason}`, {
                      defaultValue: t('purchase.promo.errors.generic'),
                    })}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                aria-invalid={!agreed && submitting}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                {t('purchase.consent.prefix')}{' '}
                <Link
                  to="/legal/offer"
                  target="_blank"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t('legal.offer')}
                </Link>{' '}
                {t('purchase.consent.connector')}{' '}
                <Link
                  to="/legal/privacy"
                  target="_blank"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {t('legal.privacy')}
                </Link>
                .
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
                {t('purchase.actions.cancel')}
              </Button>
              <Button variant="gradient" onClick={handlePay} disabled={submitting || !agreed}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isFree ? t('purchase.actions.activate') : t('purchase.actions.pay')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Бэкенд возвращает confirmationUrl вида `${APP_URL}/dev/yookassa/<yooId>`
 * для dev-bypass. Нам нужен сам yooId, чтобы дёрнуть dev/simulate-succeeded.
 */
function extractYooId(res: CreatePaymentResponse): string {
  const m = res.confirmationUrl.match(/\/dev\/yookassa\/([^/?#]+)/);
  return m?.[1] ?? '';
}

/**
 * PromosService отдаёт `{ promoError: 'reason' }` в теле 400. Достаём reason,
 * чтобы заматчить с i18n-ключами `purchase.promo.errors.<reason>`.
 */
function extractPromoErrorReason(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === 'object') {
    const r = (err.body as { promoError?: unknown; message?: unknown }).promoError;
    if (typeof r === 'string') return r;
  }
  return 'generic';
}
