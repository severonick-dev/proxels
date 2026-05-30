import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CreditCard, Link2, UserPlus } from 'lucide-react';
import { SectionHeading } from './section-heading';

const STEPS = [
  { key: 'register', Icon: UserPlus },
  { key: 'pay', Icon: CreditCard },
  { key: 'connect', Icon: Link2 },
] as const;

export function HowItWorks(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container py-20 md:py-28">
      <SectionHeading eyebrow={t('pages.home.how.eyebrow')} title={t('pages.home.how.title')} />
      <ol className="mt-12 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ key, Icon }, idx) => (
          <motion.li
            key={key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, delay: idx * 0.08 }}
            className="relative rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-primary/30 bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {String(idx + 1).padStart(2, '0')}
              </span>
            </div>
            <h3 className="mt-4 text-base font-semibold">
              {t(`pages.home.how.steps.${key}.title`)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(`pages.home.how.steps.${key}.body`)}
            </p>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
