import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getConsent, setConsent, onConsentChange } from '@/lib/cookie-consent';

/**
 * Cookie-баннер. Появляется только если согласие ещё не дано.
 * Закрытие крестиком == «только необходимые» (т.е. отказ от аналитики).
 */
export function CookieBanner(): JSX.Element | null {
  const { t } = useTranslation();
  const [needDecision, setNeedDecision] = useState(false);

  useEffect(() => {
    setNeedDecision(getConsent() === null);
    return onConsentChange((c) => setNeedDecision(c === null));
  }, []);

  const accept = (analytics: boolean) => {
    setConsent(analytics);
  };

  return (
    <AnimatePresence>
      {needDecision && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl md:inset-x-4 md:bottom-4"
        >
          <div className="rounded-2xl border border-border bg-card/95 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient text-white">
                <Cookie className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold">{t('cookieBanner.title')}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('cookieBanner.body')}{' '}
                    <Link
                      to="/legal/cookies"
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {t('cookieBanner.learnMore')}
                    </Link>
                    .
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => accept(false)}>
                    {t('cookieBanner.onlyNecessary')}
                  </Button>
                  <Button size="sm" variant="gradient" onClick={() => accept(true)}>
                    {t('cookieBanner.acceptAll')}
                  </Button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => accept(false)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label={t('cookieBanner.close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
