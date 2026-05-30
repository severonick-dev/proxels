import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

type PromoKind = 'percent' | 'fixedRub';

interface Promo {
  id: string;
  code: string;
  discountKind: PromoKind;
  discountValue: number;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usedCount: number;
  perUserLimit: number;
  appliesToPlanIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreatePromoBody {
  code: string;
  discountKind: PromoKind;
  discountValue: number;
  maxUses?: number;
  perUserLimit?: number;
  validUntil?: string;
}

export default function AdminPromosPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreatePromoBody>({
    code: '',
    discountKind: 'percent',
    discountValue: 10,
  });

  const promosQ = useQuery({
    queryKey: ['admin', 'promos'],
    queryFn: () => apiRequest<Promo[]>('/admin/promos'),
  });

  const createMutation = useMutation({
    mutationFn: (body: CreatePromoBody) =>
      apiRequest<Promo>('/admin/promos', { method: 'POST', body }),
    onSuccess: () => {
      toast.success(t('admin.promos.toast.created'));
      setCreating(false);
      setForm({ code: '', discountKind: 'percent', discountValue: 10 });
      void qc.invalidateQueries({ queryKey: ['admin', 'promos'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/promos/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('admin.promos.toast.deactivated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'promos'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const locale = i18n.resolvedLanguage ?? 'ru';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: CreatePromoBody = {
      code: form.code.trim().toUpperCase(),
      discountKind: form.discountKind,
      discountValue: Number(form.discountValue),
    };
    if (form.maxUses) body.maxUses = Number(form.maxUses);
    if (form.perUserLimit !== undefined) body.perUserLimit = Number(form.perUserLimit);
    if (form.validUntil) body.validUntil = new Date(form.validUntil).toISOString();
    createMutation.mutate(body);
  };

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('admin.promos.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.promos.subtitle', { count: promosQ.data?.length ?? 0 })}
          </p>
        </div>
        <Button onClick={() => setCreating((v) => !v)} variant={creating ? 'ghost' : 'gradient'}>
          {creating ? (
            t('admin.promos.cancel')
          ) : (
            <>
              <Plus className="h-4 w-4" /> {t('admin.promos.add')}
            </>
          )}
        </Button>
      </header>

      {creating && (
        <form
          onSubmit={submit}
          className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-5 md:grid-cols-2"
        >
          <div>
            <Label htmlFor="promo-code">{t('admin.promos.fields.code')}</Label>
            <Input
              id="promo-code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              maxLength={32}
              required
              className="uppercase"
              placeholder="WELCOME20"
            />
          </div>
          <div>
            <Label htmlFor="promo-kind">{t('admin.promos.fields.kind')}</Label>
            <select
              id="promo-kind"
              value={form.discountKind}
              onChange={(e) => setForm({ ...form, discountKind: e.target.value as PromoKind })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="percent">{t('admin.promos.kinds.percent')}</option>
              <option value="fixedRub">{t('admin.promos.kinds.fixedRub')}</option>
            </select>
          </div>
          <div>
            <Label htmlFor="promo-value">
              {form.discountKind === 'percent'
                ? t('admin.promos.fields.percentValue')
                : t('admin.promos.fields.rubValue')}
            </Label>
            <Input
              id="promo-value"
              type="number"
              min={1}
              max={form.discountKind === 'percent' ? 100 : 1_000_000}
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })}
              required
            />
          </div>
          <div>
            <Label htmlFor="promo-maxuses">{t('admin.promos.fields.maxUses')}</Label>
            <Input
              id="promo-maxuses"
              type="number"
              min={1}
              value={form.maxUses ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  maxUses: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={t('admin.promos.fields.unlimited')}
            />
          </div>
          <div>
            <Label htmlFor="promo-peruser">{t('admin.promos.fields.perUserLimit')}</Label>
            <Input
              id="promo-peruser"
              type="number"
              min={0}
              value={form.perUserLimit ?? 1}
              onChange={(e) => setForm({ ...form, perUserLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="promo-until">{t('admin.promos.fields.validUntil')}</Label>
            <Input
              id="promo-until"
              type="date"
              value={form.validUntil ?? ''}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value || undefined })}
            />
          </div>
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreating(false)}
              disabled={createMutation.isPending}
            >
              {t('admin.promos.cancel')}
            </Button>
            <Button type="submit" variant="gradient" disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('admin.promos.create')}
            </Button>
          </div>
        </form>
      )}

      {promosQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.code')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.discount')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.usage')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.perUser')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.validUntil')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.promos.cols.active')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('admin.promos.cols.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {promosQ.data?.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    'border-b border-border/60 last:border-b-0',
                    !p.isActive && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-2.5 font-mono font-medium">{p.code}</td>
                  <td className="px-4 py-2.5">
                    {p.discountKind === 'percent'
                      ? `-${p.discountValue}%`
                      : `-${p.discountValue} ₽`}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.usedCount} / {p.maxUses ?? '∞'}
                  </td>
                  <td className="px-4 py-2.5">{p.perUserLimit}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {p.validUntil ? new Date(p.validUntil).toLocaleDateString(locale) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    {p.isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {p.isActive && (
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.promos.actions.deactivate')}
                        onClick={() => {
                          if (
                            window.confirm(t('admin.promos.confirmDeactivate', { code: p.code }))
                          ) {
                            deactivateMutation.mutate(p.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    )}
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
