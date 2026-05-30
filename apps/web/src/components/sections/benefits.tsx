import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Gauge, Lock, ShieldCheck, Zap } from 'lucide-react';
import { SectionHeading } from './section-heading';

const ITEMS = [
  { key: 'speed', Icon: Gauge },
  { key: 'stability', Icon: Zap },
  { key: 'privacy', Icon: ShieldCheck },
  { key: 'simplicity', Icon: Lock },
] as const;

export function Benefits(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container py-20 md:py-28">
      <SectionHeading
        eyebrow={t('pages.home.benefits.eyebrow')}
        title={t('pages.home.benefits.title')}
        subtitle={t('pages.home.benefits.subtitle')}
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map(({ key, Icon }, idx) => (
          <motion.article
            key={key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, delay: idx * 0.06 }}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-[0_8px_24px_-12px_hsl(252_84%_56%/0.6)]">
              <Icon className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">{t(`pages.home.benefits.${key}.title`)}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`pages.home.benefits.${key}.body`)}
            </p>
            <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
          </motion.article>
        ))}
      </div>
    </section>
  );
}
