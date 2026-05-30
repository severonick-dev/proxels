import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { AuthCard } from '@/components/auth/auth-card';
import { CaptchaField } from '@/components/auth/captcha-field';
import { SEO } from '@/components/seo/seo';
import { apiRequest, ApiError } from '@/lib/api';
import { useAuthStore, type AuthUser } from '@/stores/auth-store';

const schema = z.object({
  email: z.string().email('forms.errors.email').max(254),
  password: z.string().min(1, 'forms.errors.required').max(128),
  totpCode: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export default function LoginPage(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsTotp, setNeedsTotp] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', totpCode: '' },
  });

  const onSubmit = async (values: FormValues) => {
    if (!captchaToken) {
      toast.error(t('forms.errors.captcha'));
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        email: values.email,
        password: values.password,
        captchaToken,
      };
      if (values.totpCode) body.totpCode = values.totpCode;

      const res = await apiRequest<LoginResponse>('/auth/login', {
        method: 'POST',
        body,
        auth: false,
      });
      setAuth(res.accessToken, res.user);
      toast.success(t('auth.toast.welcomeBack', { email: res.user.email }));
      const ret = params.get('return') ?? '/lk';
      navigate(decodeURIComponent(ret), { replace: true });
    } catch (err) {
      // Если бэк сказал «нужен TOTP» — показываем поле и просим ввести.
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        typeof err.body === 'object' &&
        err.body !== null &&
        (err.body as { requiresTotp?: boolean }).requiresTotp === true
      ) {
        setNeedsTotp(true);
        toast.info(t('auth.totp.required'));
        return;
      }
      const msg =
        err instanceof ApiError && err.status === 403
          ? t('auth.errors.emailNotVerified')
          : err instanceof ApiError && err.status === 401
            ? needsTotp
              ? t('auth.totp.invalid')
              : t('auth.errors.invalidCredentials')
            : (err as Error).message;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEO
        title={t('pages.auth.login.title')}
        description={t('pages.auth.login.title')}
        path="/auth/login"
        noindex
      />
      <AuthCard
        title={t('pages.auth.login.title')}
        subtitle={t('pages.auth.login.subtitle')}
        footer={
          <>
            <Link to="/auth/forgot-password" className="hover:text-foreground">
              {t('auth.links.forgot')}
            </Link>
            {' · '}
            <Link to="/auth/register" className="hover:text-foreground">
              {t('auth.links.toRegister')}
            </Link>
          </>
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
            error={
              form.formState.errors.password && t(form.formState.errors.password.message ?? '')
            }
          >
            <Input type="password" autoComplete="current-password" {...form.register('password')} />
          </FormField>

          {needsTotp && (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('auth.totp.required')}
              </div>
              <p className="mt-1 text-muted-foreground">{t('auth.totp.hint')}</p>
              <div className="mt-3">
                <FormField id="totpCode" label={t('lk.security.totp.codeLabel')}>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123 456"
                    maxLength={6}
                    {...form.register('totpCode')}
                  />
                </FormField>
              </div>
            </div>
          )}

          <CaptchaField onChange={setCaptchaToken} />

          <Button type="submit" variant="gradient" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('auth.actions.signIn')}
          </Button>
        </form>
      </AuthCard>
    </>
  );
}
