import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Loader2, ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

interface StatusRes {
  enabled: boolean;
}
interface SetupRes {
  secret: string;
  otpauthUrl: string;
}

export default function LkSecurityPage(): JSX.Element {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const statusQ = useQuery({
    queryKey: ['2fa', 'status'],
    queryFn: () => apiRequest<StatusRes>('/auth/2fa/status'),
  });

  return (
    <>
      <SEO
        title={t('lk.security.title')}
        description={t('lk.security.title')}
        path="/lk/security"
        noindex
      />

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('lk.security.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lk.security.subtitle')}</p>
      </header>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              {statusQ.data?.enabled ? (
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
              ) : (
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
              )}
              {t('lk.security.totp.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('lk.security.totp.body')}</p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              statusQ.data?.enabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                : 'border-border bg-secondary text-muted-foreground'
            }`}
          >
            {statusQ.data?.enabled ? t('lk.security.totp.on') : t('lk.security.totp.off')}
          </span>
        </div>

        <div className="mt-6">
          {statusQ.isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
            </div>
          ) : statusQ.data?.enabled ? (
            <DisableForm onSuccess={() => qc.invalidateQueries({ queryKey: ['2fa', 'status'] })} />
          ) : (
            <EnableFlow onSuccess={() => qc.invalidateQueries({ queryKey: ['2fa', 'status'] })} />
          )}
        </div>
      </section>
    </>
  );
}

function EnableFlow({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const { t } = useTranslation();
  const [setup, setSetup] = useState<SetupRes | null>(null);
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);

  const beginSetup = async () => {
    try {
      const res = await apiRequest<SetupRes>('/auth/2fa/setup', { method: 'POST' });
      setSetup(res);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const confirm = async () => {
    if (!setup) return;
    setConfirming(true);
    try {
      await apiRequest('/auth/2fa/confirm', { method: 'POST', body: { code } });
      toast.success(t('lk.security.totp.toast.enabled'));
      setSetup(null);
      setCode('');
      onSuccess();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConfirming(false);
    }
  };

  if (!setup) {
    return (
      <Button onClick={beginSetup} variant="gradient">
        {t('lk.security.totp.enable')}
      </Button>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('lk.security.totp.scanInstruction')}</p>

      <div className="flex flex-wrap items-start gap-5">
        <div className="rounded-md bg-white p-3">
          <QRCodeSVG value={setup.otpauthUrl} size={176} marginSize={0} level="M" />
        </div>
        <div className="flex-1 space-y-2 text-sm">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {t('lk.security.totp.secret')}
          </div>
          <code className="block break-all rounded-md bg-secondary px-3 py-2 font-mono text-xs">
            {setup.secret}
          </code>
          <p className="text-xs text-muted-foreground">{t('lk.security.totp.secretHint')}</p>
        </div>
      </div>

      <FormField id="totp-code" label={t('lk.security.totp.codeLabel')}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123 456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          maxLength={6}
        />
      </FormField>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => setSetup(null)}>
          {t('purchase.actions.cancel')}
        </Button>
        <Button onClick={confirm} variant="gradient" disabled={confirming || code.length !== 6}>
          {confirming && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('lk.security.totp.confirm')}
        </Button>
      </div>
    </div>
  );
}

function DisableForm({ onSuccess }: { onSuccess: () => void }): JSX.Element {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const mutation = useMutation({
    mutationFn: () => apiRequest('/auth/2fa/disable', { method: 'POST', body: { password } }),
    onSuccess: () => {
      toast.success(t('lk.security.totp.toast.disabled'));
      setPassword('');
      onSuccess();
    },
    onError: (err) => toast.error((err as Error).message),
  });

  return (
    <div className="space-y-4">
      <FormField id="disable-pwd" label={t('forms.fields.currentPassword')}>
        <Input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      <Button
        onClick={() => mutation.mutate()}
        variant="default"
        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        disabled={mutation.isPending || password.length < 1}
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {t('lk.security.totp.disable')}
      </Button>
    </div>
  );
}
