import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';

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
}

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

  const handlePay = async () => {
    if (!plan) return;
    if (!agreed) {
      toast.error(t('purchase.errors.offerRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest<CreatePaymentResponse>('/payments/create', {
        method: 'POST',
        body: { planId: plan.id, offerAccepted: true },
      });

      if (res.bypassed) {
        // Dev-bypass: автоматически шлём «успех» и редиректим в ЛК.
        await apiRequest(
          `/payments/dev/simulate-succeeded/${encodeURIComponent(extractYooId(res))}`,
          {
            method: 'POST',
          },
        ).catch(() => {
          /* лучшая попытка — если упал, юзер всё равно увидит pending в ЛК */
        });
        toast.success(t('purchase.toast.devSimulated'));
        onOpenChange(false);
        navigate('/lk', { replace: true });
        return;
      }

      // Боевой YooKassa flow.
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
              <div className="mt-1 font-display text-3xl font-bold">{plan.priceRub} ₽</div>
            </div>

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
                {t('purchase.actions.pay')}
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
