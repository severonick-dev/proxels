import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { AuthCard } from '@/components/auth/auth-card';
import { CaptchaField } from '@/components/auth/captcha-field';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

const schema = z.object({
  email: z.string().email('forms.errors.email').max(254),
  password: z.string().min(10, 'forms.errors.passwordMin').max(128, 'forms.errors.passwordMax'),
  consentPdn: z.literal(true, { errorMap: () => ({ message: 'forms.errors.consentRequired' }) }),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', consentPdn: undefined as unknown as true },
  });

  const consentChecked = form.watch('consentPdn');

  const onSubmit = async (values: FormValues) => {
    if (!captchaToken) {
      toast.error(t('forms.errors.captcha'));
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest('/auth/register', {
        method: 'POST',
        body: { ...values, captchaToken, website },
        auth: false,
      });
      toast.success(t('auth.toast.registered'), {
        description: t('auth.toast.checkInbox', { email: values.email }),
        duration: 8000,
      });
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
        title={t('pages.auth.register.title')}
        description={t('pages.auth.register.title')}
        path="/auth/register"
        noindex
      />
      <AuthCard
        title={t('pages.auth.register.title')}
        subtitle={t('pages.auth.register.subtitle')}
        footer={
          <Link to="/auth/login" className="hover:text-foreground">
            {t('auth.links.toLogin')}
          </Link>
        }
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            id="email"
            label={t('forms.fields.email')}
            error={form.formState.errors.email && t(form.formState.errors.email.message ?? '')}
          >
            <Input type="email" autoComplete="email" {...form.register('email')} />
          </FormField>
          <FormField
            id="password"
            label={t('forms.fields.password')}
            hint={t('forms.hints.passwordMin')}
            error={
              form.formState.errors.password && t(form.formState.errors.password.message ?? '')
            }
          >
            <Input type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>

          {/* honeypot — реальному пользователю невидим */}
          <div className="absolute -left-[9999px] h-0 overflow-hidden" aria-hidden tabIndex={-1}>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="text"
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                checked={!!consentChecked}
                onCheckedChange={(v) =>
                  form.setValue('consentPdn', v === true ? true : (false as unknown as true), {
                    shouldValidate: true,
                  })
                }
                aria-invalid={!!form.formState.errors.consentPdn}
              />
              <span className="text-muted-foreground">
                {t('auth.register.consentPrefix')}{' '}
                <Link to="/legal/privacy" className="text-primary hover:underline">
                  {t('legal.privacy')}
                </Link>{' '}
                {t('auth.register.consentConnector')}{' '}
                <Link to="/legal/offer" className="text-primary hover:underline">
                  {t('legal.offer')}
                </Link>
                .
              </span>
            </label>
            {form.formState.errors.consentPdn && (
              <p className="text-xs text-destructive">
                {t(form.formState.errors.consentPdn.message ?? '')}
              </p>
            )}
          </div>

          <CaptchaField onChange={setCaptchaToken} />

          <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.actions.signUp')}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
