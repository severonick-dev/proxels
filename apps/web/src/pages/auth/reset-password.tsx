import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { AuthCard } from '@/components/auth/auth-card';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

const schema = z
  .object({
    newPassword: z
      .string()
      .min(10, 'forms.errors.passwordMin')
      .max(128, 'forms.errors.passwordMax'),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: 'forms.errors.passwordMismatch',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export default function ResetPasswordPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { newPassword: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!token) {
      toast.error(t('auth.errors.missingResetToken'));
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: { token, newPassword: values.newPassword },
        auth: false,
      });
      toast.success(t('auth.toast.passwordChanged'));
      navigate('/auth/login', { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title={t('pages.auth.reset.title')}
        description={t('pages.auth.reset.title')}
        path="/auth/reset-password"
        noindex
      />
      <AuthCard
        title={t('pages.auth.reset.title')}
        subtitle={t('pages.auth.reset.subtitle')}
        footer={
          <Link to="/auth/login" className="hover:text-foreground">
            {t('auth.links.toLogin')}
          </Link>
        }
      >
        {!token ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {t('auth.errors.missingResetToken')}
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              id="newPassword"
              label={t('forms.fields.newPassword')}
              hint={t('forms.hints.passwordMin')}
              error={
                form.formState.errors.newPassword &&
                t(form.formState.errors.newPassword.message ?? '')
              }
            >
              <Input
                type="password"
                autoComplete="new-password"
                {...form.register('newPassword')}
              />
            </FormField>
            <FormField
              id="confirm"
              label={t('forms.fields.confirmPassword')}
              error={
                form.formState.errors.confirm && t(form.formState.errors.confirm.message ?? '')
              }
            >
              <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
            </FormField>

            <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.actions.setPassword')}
            </Button>
          </form>
        )}
      </AuthCard>
    </>
  );
}
