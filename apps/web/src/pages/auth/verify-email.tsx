import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthCard } from '@/components/auth/auth-card';
import { SEO } from '@/components/seo/seo';
import { apiRequest } from '@/lib/api';

type Status = 'verifying' | 'ok' | 'error';

export default function VerifyEmailPage(): JSX.Element {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(t('auth.errors.missingVerifyToken'));
      return;
    }
    const ctl = new AbortController();
    apiRequest(`/auth/verify-email?token=${encodeURIComponent(token)}`, {
      signal: ctl.signal,
      auth: false,
    })
      .then(() => setStatus('ok'))
      .catch((err) => {
        setStatus('error');
        setMessage((err as Error).message);
      });
    return () => ctl.abort();
  }, [token, t]);

  return (
    <>
      <SEO
        title={t('pages.auth.verify.title')}
        description={t('pages.auth.verify.title')}
        path="/auth/verify-email"
        noindex
      />
      <AuthCard title={t('pages.auth.verify.title')}>
        {status === 'verifying' && (
          <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            {t('auth.verify.inProgress')}
          </div>
        )}
        {status === 'ok' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              {t('auth.verify.ok')}
            </div>
            <Button asChild variant="gradient" className="w-full">
              <Link to="/auth/login">{t('auth.actions.toLogin')}</Link>
            </Button>
          </div>
        )}
        {status === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <XCircle className="h-5 w-5" />
              <div>
                <div>{t('auth.verify.failed')}</div>
                {message && <div className="mt-1 opacity-70">{message}</div>}
              </div>
            </div>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth/login">{t('auth.actions.toLogin')}</Link>
            </Button>
          </div>
        )}
      </AuthCard>
    </>
  );
}
