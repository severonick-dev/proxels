import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CheckCircle2,
  GitBranch,
  Loader2,
  PlayCircle,
  RefreshCw,
  Sparkles,
  Terminal,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ApiError, apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface GitStatus {
  sha: string;
  shortSha: string;
  tag: string | null;
  branch: string;
  date: string;
}

interface RemoteStatus {
  latestTag: string | null;
  latestSha: string | null;
  tags: { tag: string; sha: string }[];
  mainSha: string | null;
}

interface LastRunInfo {
  runId: string;
  ref: string;
  startedAt: string;
  finishedAt: string | null;
  exitCode: number | null;
  running: boolean;
}

interface DeployStatus {
  current: GitStatus;
  remote: RemoteStatus;
  hasUpdate: boolean;
  remoteUrl: string;
  deployEnabled: boolean;
  lastRun: LastRunInfo | null;
}

interface DeployLogTail {
  running: boolean;
  exitCode: number | null;
  lines: string[];
}

export default function AdminDeployPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [confirmRef, setConfirmRef] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [tailing, setTailing] = useState(false);

  const statusQ = useQuery({
    queryKey: ['admin', 'deploy', 'status'],
    queryFn: () => apiRequest<DeployStatus>('/admin/deploy/status'),
    refetchOnWindowFocus: false,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest<RemoteStatus>('/admin/deploy/refresh', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'deploy', 'status'] });
      toast.success(t('admin.deploy.toast.refreshed'));
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const runMutation = useMutation({
    mutationFn: (body: { ref: string; totpCode: string }) =>
      apiRequest<LastRunInfo>('/admin/deploy/run', { method: 'POST', body }),
    onSuccess: () => {
      toast.success(t('admin.deploy.toast.started'));
      setConfirmRef(null);
      setTotpCode('');
      setTailing(true);
      void qc.invalidateQueries({ queryKey: ['admin', 'deploy', 'status'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.body && typeof err.body === 'object') {
        const b = err.body as { totpInvalid?: boolean; requires2faSetup?: boolean };
        if (b.requires2faSetup) {
          toast.error(t('admin.deploy.toast.need2fa'));
          return;
        }
        if (b.totpInvalid) {
          toast.error(t('admin.deploy.toast.totpInvalid'));
          return;
        }
      }
      toast.error((err as Error).message);
    },
  });

  const logQ = useQuery<DeployLogTail>({
    queryKey: ['admin', 'deploy', 'log'],
    queryFn: () => apiRequest<DeployLogTail>('/admin/deploy/log?lines=500'),
    refetchInterval: tailing ? 2000 : false,
    enabled: tailing,
  });

  // Когда run завершился — выключаем тейл.
  useEffect(() => {
    if (logQ.data && logQ.data.running === false && logQ.data.exitCode !== null) {
      const timer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ['admin', 'deploy', 'status'] });
        setTailing(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [logQ.data, qc]);

  // Авто-скролл лога вниз.
  const logBoxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (logBoxRef.current && tailing) {
      logBoxRef.current.scrollTop = logBoxRef.current.scrollHeight;
    }
  }, [logQ.data, tailing]);

  const status = statusQ.data;
  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          {t('admin.deploy.title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('admin.deploy.subtitle')}</p>
      </header>

      {statusQ.isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      )}

      {statusQ.isError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {(statusQ.error as Error).message}
        </div>
      )}

      {status && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Current */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" /> {t('admin.deploy.current.title')}
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">
              {status.current.tag ?? status.current.shortSha}
            </div>
            <dl className="mt-4 space-y-1.5 text-sm">
              <Row label={t('admin.deploy.current.branch')} value={status.current.branch} />
              <Row label={t('admin.deploy.current.sha')} value={status.current.shortSha} mono />
              <Row
                label={t('admin.deploy.current.date')}
                value={new Date(status.current.date).toLocaleString(locale)}
              />
              <Row label="origin" value={status.remoteUrl || '—'} mono />
            </dl>
          </div>

          {/* Remote */}
          <div
            className={cn(
              'rounded-2xl border p-5',
              status.hasUpdate ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" /> {t('admin.deploy.remote.title')}
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
                title={t('admin.deploy.refresh')}
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', refreshMutation.isPending && 'animate-spin')}
                />
              </Button>
            </div>
            <div className="mt-3 font-display text-2xl font-semibold">
              {status.remote.latestTag ?? (status.remote.mainSha ? 'main' : '—')}
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {status.remote.latestTag
                ? (status.remote.latestSha?.slice(0, 7) ?? '')
                : (status.remote.mainSha?.slice(0, 7) ?? '')}
            </div>

            {status.hasUpdate && status.remote.latestTag && (
              <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                <div className="font-medium text-primary">
                  {t('admin.deploy.remote.newVersion', { tag: status.remote.latestTag })}
                </div>
                <Button
                  className="mt-3 w-full"
                  variant="gradient"
                  disabled={!status.deployEnabled}
                  onClick={() => setConfirmRef(status.remote.latestTag!)}
                  title={
                    status.deployEnabled ? t('admin.deploy.run') : t('admin.deploy.disabledHint')
                  }
                >
                  <PlayCircle className="h-4 w-4" />
                  {t('admin.deploy.run')}
                </Button>
              </div>
            )}

            {status.hasUpdate &&
              !status.remote.latestTag &&
              status.remote.mainSha &&
              status.remote.mainSha !== status.current.sha && (
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                  <div className="font-medium text-primary">
                    {t('admin.deploy.remote.newMain', {
                      sha: status.remote.mainSha.slice(0, 7),
                    })}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant="gradient"
                    disabled={!status.deployEnabled}
                    onClick={() => setConfirmRef('main')}
                    title={
                      status.deployEnabled ? t('admin.deploy.run') : t('admin.deploy.disabledHint')
                    }
                  >
                    <PlayCircle className="h-4 w-4" />
                    {t('admin.deploy.runMain')}
                  </Button>
                </div>
              )}

            {!status.hasUpdate && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-500">
                <CheckCircle2 className="h-4 w-4" />
                {t('admin.deploy.upToDate')}
              </div>
            )}

            {!status.deployEnabled && (
              <p className="mt-3 text-xs text-muted-foreground">{t('admin.deploy.disabledHint')}</p>
            )}
          </div>

          {/* Available tags */}
          {status.remote.tags.length > 0 && (
            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('admin.deploy.tags.title')}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {status.remote.tags.slice(0, 12).map((tagEntry) => (
                  <button
                    key={tagEntry.tag}
                    onClick={() => setConfirmRef(tagEntry.tag)}
                    disabled={!status.deployEnabled || tagEntry.tag === status.current.tag}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs',
                      tagEntry.tag === status.current.tag
                        ? 'cursor-not-allowed border-primary/40 bg-primary/10 text-primary'
                        : 'border-border hover:bg-accent disabled:opacity-50',
                    )}
                  >
                    {tagEntry.tag}
                    {tagEntry.tag === status.current.tag && <CheckCircle2 className="h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Log */}
          <div className="md:col-span-2 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" /> {t('admin.deploy.log.title')}
              </div>
              <div className="flex items-center gap-2">
                {status.lastRun?.running && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-primary">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    {t('admin.deploy.log.running', { ref: status.lastRun.ref })}
                  </span>
                )}
                {status.lastRun?.exitCode === 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-500">
                    <CheckCircle2 className="h-3 w-3" />
                    {t('admin.deploy.log.ok')}
                  </span>
                )}
                {status.lastRun?.exitCode !== null &&
                  status.lastRun?.exitCode !== 0 &&
                  status.lastRun?.exitCode !== undefined && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                      <XCircle className="h-3 w-3" />
                      {t('admin.deploy.log.failed', { code: status.lastRun.exitCode })}
                    </span>
                  )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setTailing((v) => !v)}
                  title={t(tailing ? 'admin.deploy.log.stop' : 'admin.deploy.log.start')}
                >
                  {tailing ? t('admin.deploy.log.stop') : t('admin.deploy.log.tail')}
                </Button>
              </div>
            </div>
            <div
              ref={logBoxRef}
              className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-border bg-background p-3 font-mono text-xs"
            >
              {logQ.data && logQ.data.lines.length > 0 ? (
                logQ.data.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      'whitespace-pre-wrap',
                      line.includes('ERROR') || line.includes('FAILED')
                        ? 'text-destructive'
                        : line.includes('OK')
                          ? 'text-emerald-500'
                          : 'text-muted-foreground',
                    )}
                  >
                    {line}
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground">{t('admin.deploy.log.empty')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog with TOTP */}
      <Dialog
        open={confirmRef !== null}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmRef(null);
            setTotpCode('');
          }
        }}
      >
        <DialogContent>
          <DialogTitle>{t('admin.deploy.confirm.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.deploy.confirm.body', { ref: confirmRef })}
          </DialogDescription>
          <div className="space-y-3 pt-2">
            <div>
              <Label htmlFor="deploy-totp">{t('admin.deploy.confirm.totpLabel')}</Label>
              <Input
                id="deploy-totp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123 456"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.deploy.confirm.totpHint')}
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                onClick={() => {
                  setConfirmRef(null);
                  setTotpCode('');
                }}
                disabled={runMutation.isPending}
              >
                {t('admin.deploy.confirm.cancel')}
              </Button>
              <Button
                variant="gradient"
                onClick={() => confirmRef && runMutation.mutate({ ref: confirmRef, totpCode })}
                disabled={runMutation.isPending || totpCode.length !== 6}
              >
                {runMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('admin.deploy.confirm.go')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('truncate', mono && 'font-mono text-xs')} title={value}>
        {value}
      </dd>
    </div>
  );
}
