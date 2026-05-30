import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SectionHeading } from './section-heading';

export const FAQ_KEYS = ['what', 'privacy', 'failover', 'payment', 'devices', 'support'] as const;
export type FaqKey = (typeof FAQ_KEYS)[number];

export function Faq(): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="container py-20 md:py-28">
      <SectionHeading eyebrow={t('pages.home.faq.eyebrow')} title={t('pages.home.faq.title')} />
      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-border bg-card/60 px-6">
        <Accordion type="single" collapsible className="w-full">
          {FAQ_KEYS.map((k) => (
            <AccordionItem key={k} value={k}>
              <AccordionTrigger>{t(`pages.home.faq.items.${k}.q`)}</AccordionTrigger>
              <AccordionContent>{t(`pages.home.faq.items.${k}.a`)}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

export function useFaqItemsForJsonLd(): { q: string; a: string }[] {
  const { t } = useTranslation();
  return FAQ_KEYS.map((k) => ({
    q: t(`pages.home.faq.items.${k}.q`),
    a: t(`pages.home.faq.items.${k}.a`),
  }));
}
