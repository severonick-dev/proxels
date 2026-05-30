import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { BRAND } from '@proxels/shared';
import { Logo } from '@/components/brand/logo';
import { PRIMARY_NAV } from './nav-items';

export function Footer(): JSX.Element {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border bg-background/40">
      <div className="container grid gap-10 py-12 md:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">{t('brand.tagline')}</p>
          <a
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Send className="h-4 w-4" />
            {BRAND.telegramHandle}
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
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            {t('footer.telegram')}: {BRAND.telegramHandle}
          </a>
          <div className="mt-3 space-y-0.5 text-xs text-muted-foreground/80">
            <div className="font-medium text-muted-foreground">{t('footer.ip.title')}</div>
            <div>{t('footer.ip.name')}</div>
            <div>{t('footer.ip.ogrnip')}</div>
            <div>{t('footer.ip.inn')}</div>
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
