import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Apple, ArrowRight, Monitor, Smartphone } from 'lucide-react';
import { SectionHeading } from './section-heading';

interface Platform {
  key: 'windows' | 'android' | 'ios';
  Icon: typeof Monitor;
  guideSlug: 'v2raytun' | 'nekobox' | 'hiddify';
}

const PLATFORMS: Platform[] = [
  { key: 'windows', Icon: Monitor, guideSlug: 'v2raytun' },
  { key: 'android', Icon: Smartphone, guideSlug: 'nekobox' },
  { key: 'ios', Icon: Apple, guideSlug: 'hiddify' },
];

/**
 * Платформенный селектор — главный CTA лендинга. Пользователь выбирает
 * операционку → попадает на регистрацию с query `?platform=<key>`. После
 * успешной верификации email login.tsx прочитает этот параметр и редиректнет
 * в соответствующий гайд.
 */
export function PlatformPicker(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container py-16 md:py-20" id="start">
      <SectionHeading
        eyebrow={t('pages.home.platform.eyebrow')}
        title={t('pages.home.platform.title')}
        subtitle={t('pages.home.platform.subtitle')}
      />
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {PLATFORMS.map(({ key, Icon, guideSlug }, idx) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.45, delay: idx * 0.06 }}
          >
            <Link
              to={`/auth/register?platform=${key}&guide=${guideSlug}`}
              className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold">
                {t(`pages.home.platform.items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`pages.home.platform.items.${key}.body`)}
              </p>
              <div className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-primary">
                {t('pages.home.platform.cta')}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
