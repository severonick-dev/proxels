import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Hero-блок лендинга.
 *
 * Анимированный фон:
 *  - Два больших радиальных «облака» с медленной флуктуацией (Framer Motion).
 *  - Тонкая точечная сетка с радиальной маской (только CSS).
 *  - Всё рендерится `aria-hidden` и не влияет на доступность/SEO.
 */
export function Hero(): JSX.Element {
  const { t } = useTranslation();

  return (
    <section className="relative isolate overflow-hidden">
      <AnimatedBackground />

      <div className="container py-24 md:py-36">
        <div className="mx-auto max-w-3xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur-sm"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
            {t('pages.home.heroBadge')}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-balance md:text-6xl"
          >
            {t('pages.home.title')}{' '}
            <span className="text-gradient">{t('pages.home.titleAccent')}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.12 }}
            className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground md:text-lg"
          >
            {t('pages.home.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-3"
          >
            <Button asChild variant="gradient" size="lg">
              <Link to="/auth/register">
                {t('pages.home.ctaTry')} <ArrowRight className="ml-0.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/pricing">{t('pages.home.ctaPricing')}</Link>
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function AnimatedBackground(): JSX.Element {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* Тонкая точечная сетка с радиальной маской. */}
      <div
        className="absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        style={{
          backgroundImage:
            'radial-gradient(circle 1px at center, hsl(var(--foreground) / 0.18) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Два плавающих радиальных «облака» в брендовых цветах. */}
      <motion.div
        className="absolute left-[10%] top-[20%] h-[520px] w-[520px] rounded-full opacity-50 mix-blend-screen blur-3xl"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, hsl(252 84% 56% / 0.55), transparent 60%)',
        }}
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute right-[10%] bottom-[10%] h-[480px] w-[480px] rounded-full opacity-50 mix-blend-screen blur-3xl"
        style={{
          backgroundImage:
            'radial-gradient(circle at center, hsl(212 92% 60% / 0.55), transparent 60%)',
        }}
        animate={{ x: [0, -40, 20, 0], y: [0, 30, -20, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Лёгкий «свет сверху» для отделения от шапки. */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}
