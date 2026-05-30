import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { BRAND } from '@proxels/shared';
import { Logo } from '@/components/brand/logo';
import { PRIMARY_NAV } from './nav-items';
import { usePublicConfig } from '@/hooks/use-public-config';

export function Footer(): JSX.Element {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  const { data: config } = usePublicConfig();

  // Реквизиты ИП: предпочитаем актуальные из API (`/config/public` → ENV
  // `OWNER_*`), фолбэк на i18n-перевод (для случая, когда API ещё не ответил).
  const ipName = config?.owner.fio ? `ИП ${shortName(config.owner.fio)}` : t('footer.ip.name');
  const ipOgrnip = config?.owner.ogrnip ? `ОГРНИП ${config.owner.ogrnip}` : t('footer.ip.ogrnip');
  const ipInn = config?.owner.inn ? `ИНН ${config.owner.inn}` : t('footer.ip.inn');
  const telegramUrl = config?.brand.telegramUrl ?? BRAND.telegramUrl;
  const telegramHandle = config?.brand.telegramHandle ?? BRAND.telegramHandle;

  return (
    <footer className="mt-24 border-t border-border bg-background/40">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t('brand.tagline')}</p>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Send className="h-4 w-4" />
            {telegramHandle}
          </a>
        </div>

        <FooterColumn title={t('footer.navTitle')}>
          {PRIMARY_NAV.map((item) => (
            <FooterLink key={item.to} to={item.to}>
              {t(item.labelKey)}
            </FooterLink>
          ))}
        </FooterColumn>

        <FooterColumn title={t('footer.legalTitle')}>
          <FooterLink to="/legal/privacy">{t('legal.privacy')}</FooterLink>
          <FooterLink to="/legal/offer">{t('legal.offer')}</FooterLink>
          <FooterLink to="/legal/cookies">{t('legal.cookies')}</FooterLink>
        </FooterColumn>

        <FooterColumn title={t('footer.contactsTitle')}>
          <a
            href={telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.telegram')}: {telegramHandle}
          </a>
          <div className="mt-3 space-y-0.5 text-xs text-muted-foreground/80">
            <div className="font-medium text-muted-foreground">{t('footer.ip.title')}</div>
            <div>{ipName}</div>
            <div>{ipOgrnip}</div>
            <div>{ipInn}</div>
          </div>
        </FooterColumn>
      </div>

      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-3 py-5 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>{t('footer.copyright', { year })}</span>
          <span className="max-w-2xl text-right text-[11px] leading-snug">
            {t('footer.noLogs')}
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }): JSX.Element {
  return (
    <Link to={to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
      {children}
    </Link>
  );
}

/** «Коробейников Сергей Сергеевич» → «Коробейников С.С.» */
function shortName(fio: string): string {
  const parts = fio.trim().split(/\s+/);
  if (parts.length < 2) return fio;
  const [last, ...rest] = parts;
  return `${last} ${rest.map((p) => p[0] + '.').join('')}`;
}
