import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

const pwdSchema = z
  .object({
    currentPassword: z.string().min(1, 'forms.errors.required'),
    newPassword: z
      .string()
      .min(10, 'forms.errors.passwordMin')
      .max(128, 'forms.errors.passwordMax'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'forms.errors.passwordMismatch',
    path: ['confirm'],
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'forms.errors.passwordSame',
    path: ['newPassword'],
  });

type PwdValues = z.infer<typeof pwdSchema>;

const deleteSchema = z.object({
  currentPassword: z.string().min(1, 'forms.errors.required'),
  confirmText: z.literal('DELETE', {
    errorMap: () => ({ message: 'lk.settings.delete.typeDeleteError' }),
  }),
});
type DeleteValues = z.infer<typeof deleteSchema>;

export default function LkSettingsPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clear);
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <SEO
        title={t('lk.settings.title')}
        description={t('lk.settings.title')}
        path="/lk/settings"
        noindex
      />

      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('lk.settings.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lk.settings.subtitle')}</p>
      </header>

      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold">{t('lk.settings.account.title')}</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <Row label={t('lk.settings.account.email')} value={user?.email ?? '—'} />
            <Row label={t('lk.settings.account.role')} value={user?.role ?? '—'} />
            <Row
              label={t('lk.settings.account.emailVerified')}
              value={
                user?.emailVerified ? t('lk.settings.account.yes') : t('lk.settings.account.no')
              }
            />
          </div>
        </section>

        <ChangePasswordCard t={t} clearAuth={clearAuth} navigate={navigate} />
        <DeleteAccountCard t={t} clearAuth={clearAuth} navigate={navigate} />
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-b-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

interface CardActProps {
  t: (k: string, opts?: Record<string, unknown>) => string;
  clearAuth: () => void;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

function ChangePasswordCard({ t, clearAuth, navigate }: CardActProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<PwdValues>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = async (values: PwdValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/auth/change-password', {
        method: 'POST',
        body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast.success(t('auth.toast.passwordChanged'), {
        description: t('auth.toast.relogin'),
      });
      clearAuth();
      navigate('/auth/login', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold">{t('lk.settings.password.title')}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('lk.settings.password.body')}</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-3" noValidate>
        <FormField
          id="currentPassword"
          label={t('forms.fields.currentPassword')}
          error={
            form.formState.errors.currentPassword &&
            t(form.formState.errors.currentPassword.message ?? '')
          }
        >
          <Input
            type="password"
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </FormField>
        <FormField
          id="newPassword"
          label={t('forms.fields.newPassword')}
          hint={t('forms.hints.passwordMin')}
          error={
            form.formState.errors.newPassword && t(form.formState.errors.newPassword.message ?? '')
          }
        >
          <Input type="password" autoComplete="new-password" {...form.register('newPassword')} />
        </FormField>
        <FormField
          id="confirm"
          label={t('forms.fields.confirmPassword')}
          error={form.formState.errors.confirm && t(form.formState.errors.confirm.message ?? '')}
        >
          <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
        </FormField>
        <Button type="submit" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('lk.settings.password.cta')}
        </Button>
      </form>
    </section>
  );
}

function DeleteAccountCard({ t, clearAuth, navigate }: CardActProps): JSX.Element {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<DeleteValues>({
    resolver: zodResolver(deleteSchema),
    defaultValues: { currentPassword: '', confirmText: '' as unknown as 'DELETE' },
  });

  const onSubmit = async (values: DeleteValues) => {
    setSubmitting(true);
    try {
      await apiRequest('/auth/me', {
        method: 'DELETE',
        body: { currentPassword: values.currentPassword },
      });
      toast.success(t('lk.settings.delete.toastDone'));
      clearAuth();
      navigate('/', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-destructive">
        <Trash2 className="h-4 w-4" /> {t('lk.settings.delete.title')}
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">{t('lk.settings.delete.body')}</p>
      <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-3" noValidate>
        <FormField
          id="del-current-password"
          label={t('forms.fields.currentPassword')}
          error={
            form.formState.errors.currentPassword &&
            t(form.formState.errors.currentPassword.message ?? '')
          }
        >
          <Input
            type="password"
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </FormField>
        <FormField
          id="del-confirm"
          label={t('lk.settings.delete.typeDelete')}
          error={
            form.formState.errors.confirmText && t(form.formState.errors.confirmText.message ?? '')
          }
        >
          <Input type="text" placeholder="DELETE" {...form.register('confirmText')} />
        </FormField>
        <Button
          type="submit"
          variant="default"
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          disabled={submitting}
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('lk.settings.delete.cta')}
        </Button>
      </form>
    </section>
  );
}
