import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { CaptchaField } from '@/components/auth/captcha-field';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

const schema = z.object({
  email: z.string().email('forms.errors.email').max(254),
});

type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage(): JSX.Element {
  const { t } = useTranslation();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!captchaToken) {
      toast.error(t('forms.errors.captcha'));
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/auth/forgot-password', {
        method: 'POST',
        body: { ...values, captchaToken },
        auth: false,
      });
      setSent(true);
    } catch (err) {
      // Бэк всегда возвращает 202 даже если email не найден — но на всякий случай.
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title={t('pages.auth.forgot.title')}
        description={t('pages.auth.forgot.title')}
        path="/auth/forgot-password"
        noindex
      />
      <AuthCard
        title={t('pages.auth.forgot.title')}
        subtitle={t('pages.auth.forgot.subtitle')}
        footer={
          <Link to="/auth/login" className="hover:text-foreground">
            {t('auth.links.toLogin')}
          </Link>
        }
      >
        {sent ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
            {t('auth.forgot.sent')}
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              id="email"
              label={t('forms.fields.email')}
              error={form.formState.errors.email && t(form.formState.errors.email.message ?? '')}
            >
              <Input type="email" autoComplete="email" {...form.register('email')} />
            </FormField>

            <CaptchaField onChange={setCaptchaToken} />

            <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('auth.actions.sendResetLink')}
            </Button>
          </form>
        )}
      </AuthCard>
    </>
  );
}
