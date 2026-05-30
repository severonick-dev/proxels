import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ArrowRight, Smartphone } from 'lucide-react';
import { SectionHeading } from './section-heading';

const APPS = ['nekobox', 'hiddify', 'v2raytun'] as const;

export function SupportedApps(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container py-20 md:py-28">
      <SectionHeading
        eyebrow={t('pages.home.apps.eyebrow')}
        title={t('pages.home.apps.title')}
        subtitle={t('pages.home.apps.subtitle')}
      />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {APPS.map((key, idx) => (
          <motion.article
            key={key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, delay: idx * 0.06 }}
            className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/30"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-primary">
                <Smartphone className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold">
                  {t(`pages.home.apps.items.${key}.name`)}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {t(`pages.home.apps.items.${key}.platforms`)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {t(`pages.home.apps.items.${key}.body`)}
            </p>
            <Link
              to={`/guides#${key}`}
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-80 transition-opacity hover:opacity-100"
            >
              {t('pages.home.apps.guideLink')}{' '}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
