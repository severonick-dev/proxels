import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface NodeRow {
  id: string;
  name: string;
  host: string;
  port: number;
  country: string;
  xrayApiAddr: string;
  publicKey: string;
  shortId: string;
  sni: string;
  inboundTag: string;
  fallbackUuid: string | null;
  cdnHost: string | null;
  cdnPath: string | null;
  wsInboundTag: string | null;
  status: 'online' | 'offline' | 'degraded';
  isActive: boolean;
  weight: number;
  lastCheckAt: string | null;
}

interface NodeFormState {
  name: string;
  host: string;
  port: number;
  country: string;
  xrayApiAddr: string;
  publicKey: string;
  shortId: string;
  sni: string;
  inboundTag: string;
  weight: number;
  fallbackUuid: string;
  cdnHost: string;
  cdnPath: string;
  wsInboundTag: string;
  isActive: boolean;
}

const EMPTY: NodeFormState = {
  name: '',
  host: '',
  port: 443,
  country: 'DE',
  xrayApiAddr: '',
  publicKey: '',
  shortId: '',
  sni: 'www.microsoft.com',
  inboundTag: 'vless-reality',
  weight: 100,
  fallbackUuid: '',
  cdnHost: '',
  cdnPath: '',
  wsInboundTag: '',
  isActive: true,
};

const STATUS_COLOR: Record<NodeRow['status'], string> = {
  online: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
  offline: 'border-destructive/30 bg-destructive/10 text-destructive',
  degraded: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500',
};

interface HealthEntry {
  latencyMs: number | null;
  lastProbeOk: boolean;
  lastProbeAt: string;
}

interface HealthNodeRow extends NodeRow {
  health: HealthEntry | null;
}

interface HealthRes {
  onlineCount: number;
  nodes: HealthNodeRow[];
}

function latencyClass(ms: number | null, online: boolean): string {
  if (!online || ms === null) {
    return 'border-border bg-secondary/40 text-muted-foreground';
  }
  if (ms < 50) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500';
  if (ms < 150) return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-500';
  return 'border-orange-500/30 bg-orange-500/10 text-orange-500';
}

export default function AdminNodesPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<NodeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NodeFormState>(EMPTY);

  const locale = i18n.resolvedLanguage ?? 'ru';

  // Запрашиваем полный список через CRUD-эндпоинт (включает inactive ноды + все
  // CRUD-поля, которые нужны для редактирования: publicKey, shortId, cdn*).
  // Refresh 10 sec — чтобы статус обновлялся при изменении health-check'а.
  const nodesQ = useQuery({
    queryKey: ['admin', 'nodes-list'],
    queryFn: () => apiRequest<NodeRow[]>('/admin/nodes'),
    refetchInterval: 10_000,
  });
  // onlineCount — отдельный кешированный счётчик (для подзаголовка). Лёгкий
  // запрос. Если нужно — можно посчитать на клиенте из nodesQ.data.
  const healthQ = useQuery({
    queryKey: ['admin', 'nodes-health'],
    queryFn: () => apiRequest<HealthRes>('/admin/nodes/health'),
    refetchInterval: 10_000,
  });

  // Map nodeId → последний health-entry (latencyMs + lastProbeOk).
  // Таблица рендерится из nodesQ (CRUD-эндпоинт, со всеми полями), latency
  // пробрасываем сюда из health-эндпоинта.
  const healthById = new Map<string, HealthEntry>();
  for (const n of healthQ.data?.nodes ?? []) {
    if (n.health) healthById.set(n.id, n.health);
  }

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

  const openEdit = (n: NodeRow) => {
    setCreating(false);
    setEditing(n);
    setForm({
      name: n.name,
      host: n.host,
      port: n.port,
      country: n.country,
      xrayApiAddr: n.xrayApiAddr,
      publicKey: n.publicKey,
      shortId: n.shortId,
      sni: n.sni,
      inboundTag: n.inboundTag,
      weight: n.weight,
      fallbackUuid: n.fallbackUuid ?? '',
      cdnHost: n.cdnHost ?? '',
      cdnPath: n.cdnPath ?? '',
      wsInboundTag: n.wsInboundTag ?? '',
      isActive: n.isActive,
    });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<NodeRow>('/admin/nodes', { method: 'POST', body }),
    onSuccess: () => {
      toast.success(t('admin.nodes.toast.created'));
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-list'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-health'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest<NodeRow>(`/admin/nodes/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success(t('admin.nodes.toast.updated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-list'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-health'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/nodes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('admin.nodes.toast.deactivated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-list'] });
      void qc.invalidateQueries({ queryKey: ['admin', 'nodes-health'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const reissueMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ ok: number; failed: number; total: number }>(
        `/admin/nodes/${id}/reissue`,
        { method: 'POST' },
      ),
    onSuccess: (res) => {
      toast.success(t('admin.nodes.toast.reissued', { ok: res.ok, total: res.total }));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Сборка body — пустые опциональные поля шлём как null чтобы можно было их
    // ОЧИСТИТЬ через UI (например выключить CDN-канал).
    const body: Record<string, unknown> = {
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port),
      country: form.country.trim().toUpperCase(),
      xrayApiAddr: form.xrayApiAddr.trim(),
      publicKey: form.publicKey.trim(),
      shortId: form.shortId.trim(),
      sni: form.sni.trim(),
      inboundTag: form.inboundTag.trim() || 'vless-reality',
      weight: Number(form.weight),
    };
    // fallback/cdn-поля — только если непустые. На PATCH разрешим явное null
    // в будущем (сейчас оставляем как есть).
    const trim = (s: string) => s.trim();
    if (trim(form.fallbackUuid)) body.fallbackUuid = trim(form.fallbackUuid);
    if (trim(form.cdnHost)) body.cdnHost = trim(form.cdnHost);
    if (trim(form.cdnPath)) body.cdnPath = trim(form.cdnPath);
    if (trim(form.wsInboundTag)) body.wsInboundTag = trim(form.wsInboundTag);

    if (editing) {
      // На обновлении проталкиваем isActive — единственный non-create-only флаг.
      body.isActive = form.isActive;
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
            {t('admin.nodes.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {healthQ.data
              ? t('admin.nodes.subtitle', {
                  online: healthQ.data.onlineCount,
                  total: nodesQ.data?.length ?? healthQ.data.nodes.length,
                })
              : t('admin.nodes.subtitleLoading')}
          </p>
        </div>
        <Button onClick={openCreate} variant="gradient">
          <Plus className="h-4 w-4" /> {t('admin.nodes.add')}
        </Button>
      </header>

      {nodesQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : nodesQ.error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(nodesQ.error as Error).message}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.name')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.host')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.status')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.latency')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.weight')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.nodes.cols.lastProbe')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('admin.nodes.cols.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {nodesQ.data?.map((n) => (
                <tr
                  key={n.id}
                  className={cn(
                    'border-b border-border/60 last:border-b-0',
                    !n.isActive && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{n.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.country} · {n.xrayApiAddr}
                      {n.cdnHost && (
                        <>
                          {' · '}
                          <span className="text-emerald-500">CDN: {n.cdnHost}</span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    {n.host}:{n.port}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-xs font-medium',
                        STATUS_COLOR[n.status],
                      )}
                    >
                      {n.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const h = healthById.get(n.id);
                      const ms = h?.latencyMs ?? null;
                      const online = n.status === 'online' && h?.lastProbeOk === true;
                      return (
                        <span
                          className={cn(
                            'rounded-full border px-2 py-0.5 font-mono text-xs',
                            latencyClass(ms, online),
                          )}
                          title={t('admin.nodes.latencyHint')}
                        >
                          {ms !== null ? `${ms} ${t('admin.nodes.ms')}` : '—'}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-2.5">{n.weight}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {n.lastCheckAt ? new Date(n.lastCheckAt).toLocaleString(locale) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.nodes.actions.reissue')}
                        disabled={reissueMutation.isPending}
                        onClick={() => {
                          if (window.confirm(t('admin.nodes.confirmReissue', { name: n.name }))) {
                            reissueMutation.mutate(n.id);
                          }
                        }}
                      >
                        {reissueMutation.isPending && reissueMutation.variables === n.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.nodes.actions.edit')}
                        onClick={() => openEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {n.isActive && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t('admin.nodes.actions.deactivate')}
                          onClick={() => {
                            if (
                              window.confirm(t('admin.nodes.confirmDeactivate', { name: n.name }))
                            ) {
                              deactivateMutation.mutate(n.id);
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle>
            {editing ? t('admin.nodes.dialog.editTitle') : t('admin.nodes.dialog.createTitle')}
          </DialogTitle>

          <form onSubmit={submit} className="grid gap-4 pt-2 md:grid-cols-2">
            {/* --- Базовые поля --- */}
            <div>
              <Label htmlFor="node-name">{t('admin.nodes.fields.name')}</Label>
              <Input
                id="node-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={64}
                placeholder="de-2"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-country">{t('admin.nodes.fields.country')}</Label>
              <Input
                id="node-country"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                maxLength={8}
                placeholder="DE"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-host">{t('admin.nodes.fields.host')}</Label>
              <Input
                id="node-host"
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                maxLength={255}
                placeholder="212.113.104.89"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-port">{t('admin.nodes.fields.port')}</Label>
              <Input
                id="node-port"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={(e) => setForm({ ...form, port: Number(e.target.value) })}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="node-api">{t('admin.nodes.fields.xrayApiAddr')}</Label>
              <Input
                id="node-api"
                value={form.xrayApiAddr}
                onChange={(e) => setForm({ ...form, xrayApiAddr: e.target.value })}
                maxLength={255}
                placeholder="212.113.104.89:10085"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.nodes.fields.xrayApiAddrHint')}
              </p>
            </div>

            {/* --- Reality --- */}
            <div className="md:col-span-2 mt-2 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.nodes.sections.reality')}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="node-pbk">{t('admin.nodes.fields.publicKey')}</Label>
              <Input
                id="node-pbk"
                value={form.publicKey}
                onChange={(e) => setForm({ ...form, publicKey: e.target.value })}
                maxLength={255}
                placeholder="ZZY1smwbLJDwKnonhcEVIyMY1JjpGqivrJAes5M5MVY"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-sid">{t('admin.nodes.fields.shortId')}</Label>
              <Input
                id="node-sid"
                value={form.shortId}
                onChange={(e) => setForm({ ...form, shortId: e.target.value })}
                maxLength={64}
                placeholder="2a6e9c370e4ea413"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-sni">{t('admin.nodes.fields.sni')}</Label>
              <Input
                id="node-sni"
                value={form.sni}
                onChange={(e) => setForm({ ...form, sni: e.target.value })}
                maxLength={255}
                placeholder="www.microsoft.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="node-tag">{t('admin.nodes.fields.inboundTag')}</Label>
              <Input
                id="node-tag"
                value={form.inboundTag}
                onChange={(e) => setForm({ ...form, inboundTag: e.target.value })}
                maxLength={64}
                placeholder="vless-reality"
              />
            </div>
            <div>
              <Label htmlFor="node-weight">{t('admin.nodes.fields.weight')}</Label>
              <Input
                id="node-weight"
                type="number"
                min={0}
                max={1000}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
              />
            </div>

            {/* --- Опциональные поля: CDN + fallback --- */}
            <div className="md:col-span-2 mt-2 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.nodes.sections.cdn')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.nodes.sections.cdnHint')}
              </p>
            </div>
            <div>
              <Label htmlFor="node-cdn-host">{t('admin.nodes.fields.cdnHost')}</Label>
              <Input
                id="node-cdn-host"
                value={form.cdnHost}
                onChange={(e) => setForm({ ...form, cdnHost: e.target.value })}
                maxLength={255}
                placeholder="de1.proxels.ru"
              />
            </div>
            <div>
              <Label htmlFor="node-cdn-path">{t('admin.nodes.fields.cdnPath')}</Label>
              <Input
                id="node-cdn-path"
                value={form.cdnPath}
                onChange={(e) => setForm({ ...form, cdnPath: e.target.value })}
                maxLength={255}
                placeholder="/proxy"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="node-ws-tag">{t('admin.nodes.fields.wsInboundTag')}</Label>
              <Input
                id="node-ws-tag"
                value={form.wsInboundTag}
                onChange={(e) => setForm({ ...form, wsInboundTag: e.target.value })}
                maxLength={64}
                placeholder="vless-ws"
              />
            </div>

            <div className="md:col-span-2 mt-2 border-t border-border pt-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t('admin.nodes.sections.advanced')}
              </p>
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="node-fallback">{t('admin.nodes.fields.fallbackUuid')}</Label>
              <Input
                id="node-fallback"
                value={form.fallbackUuid}
                onChange={(e) => setForm({ ...form, fallbackUuid: e.target.value })}
                maxLength={64}
                placeholder="00000000-0000-0000-0000-000000000001"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.nodes.fields.fallbackUuidHint')}
              </p>
            </div>

            {editing && (
              <div className="md:col-span-2 flex items-center gap-2 pt-1">
                <input
                  id="node-active"
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <Label htmlFor="node-active" className="cursor-pointer">
                  {t('admin.nodes.fields.active')}
                </Label>
              </div>
            )}

            <div className="md:col-span-2 flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeForm} disabled={pending}>
                {t('admin.nodes.cancel')}
              </Button>
              <Button type="submit" variant="gradient" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? t('admin.nodes.save') : t('admin.nodes.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
