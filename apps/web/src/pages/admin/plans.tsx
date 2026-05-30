import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface Plan {
  id: string;
  name: string;
  priceRub: number;
  durationDays: number;
  trafficLimitGb: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface PlanFormState {
  name: string;
  priceRub: number;
  durationDays: number;
  trafficLimitGb: number | '';
  sortOrder: number;
  isActive: boolean;
}

const EMPTY: PlanFormState = {
  name: '',
  priceRub: 0,
  durationDays: 30,
  trafficLimitGb: '',
  sortOrder: 0,
  isActive: true,
};

export default function AdminPlansPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<PlanFormState>(EMPTY);

  const plansQ = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => apiRequest<Plan[]>('/admin/plans'),
  });

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  };

  const openEdit = (p: Plan) => {
    setCreating(false);
    setEditing(p);
    setForm({
      name: p.name,
      priceRub: p.priceRub,
      durationDays: p.durationDays,
      trafficLimitGb: p.trafficLimitGb ?? '',
      sortOrder: p.sortOrder,
      isActive: p.isActive,
    });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<Plan>('/admin/plans', { method: 'POST', body }),
    onSuccess: () => {
      toast.success(t('admin.plans.toast.created'));
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest<Plan>(`/admin/plans/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success(t('admin.plans.toast.updated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/plans/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('admin.plans.toast.deactivated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      priceRub: Number(form.priceRub),
      durationDays: Number(form.durationDays),
      sortOrder: Number(form.sortOrder),
      isActive: form.isActive,
    };
    if (form.trafficLimitGb !== '' && Number(form.trafficLimitGb) > 0) {
      body.trafficLimitGb = Number(form.trafficLimitGb);
    }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;
  const dialogOpen = creating || editing !== null;

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('admin.plans.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.plans.subtitle', { count: plansQ.data?.length ?? 0 })}
          </p>
        </div>
        <Button onClick={openCreate} variant="gradient">
          <Plus className="h-4 w-4" /> {t('admin.plans.add')}
        </Button>
      </header>

      {plansQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.name')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.price')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.duration')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.traffic')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.sort')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.plans.cols.active')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('admin.plans.cols.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {plansQ.data?.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    'border-b border-border/60 last:border-b-0',
                    !p.isActive && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">{p.name}</td>
                  <td className="px-4 py-2.5">
                    {p.priceRub === 0 ? t('admin.plans.free') : `${p.priceRub} ₽`}
                  </td>
                  <td className="px-4 py-2.5">{p.durationDays}d</td>
                  <td className="px-4 py-2.5">
                    {p.trafficLimitGb === null
                      ? t('admin.plans.unlimited')
                      : `${p.trafficLimitGb} GB`}
                  </td>
                  <td className="px-4 py-2.5">{p.sortOrder}</td>
                  <td className="px-4 py-2.5">
                    {p.isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.plans.actions.edit')}
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {p.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t('admin.plans.actions.deactivate')}
                          onClick={() => {
                            if (
                              window.confirm(t('admin.plans.confirmDeactivate', { name: p.name }))
                            ) {
                              deactivateMutation.mutate(p.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent>
          <DialogTitle>
            {editing ? t('admin.plans.dialog.editTitle') : t('admin.plans.dialog.createTitle')}
          </DialogTitle>
          <form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="plan-name">{t('admin.plans.fields.name')}</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                required
              />
            </div>
            <div>
              <Label htmlFor="plan-price">{t('admin.plans.fields.price')}</Label>
              <Input
                id="plan-price"
                type="number"
                min={0}
                max={1_000_000}
                value={form.priceRub}
                onChange={(e) => setForm({ ...form, priceRub: Number(e.target.value) })}
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.plans.fields.priceHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="plan-duration">{t('admin.plans.fields.duration')}</Label>
              <Input
                id="plan-duration"
                type="number"
                min={1}
                max={3650}
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: Number(e.target.value) })}
                required
              />
            </div>
            <div>
              <Label htmlFor="plan-traffic">{t('admin.plans.fields.traffic')}</Label>
              <Input
                id="plan-traffic"
                type="number"
                min={1}
                max={100_000}
                value={form.trafficLimitGb}
                onChange={(e) =>
                  setForm({
                    ...form,
                    trafficLimitGb: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                placeholder={t('admin.plans.unlimited')}
              />
            </div>
            <div>
              <Label htmlFor="plan-sort">{t('admin.plans.fields.sort')}</Label>
              <Input
                id="plan-sort"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
              />
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                {t('admin.plans.fields.active')}
              </label>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeForm} disabled={pending}>
                {t('admin.plans.cancel')}
              </Button>
              <Button type="submit" variant="gradient" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? t('admin.plans.save') : t('admin.plans.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
