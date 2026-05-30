import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { BRAND } from '@proxels/shared';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { MobileNav } from './mobile-nav';
import { PRIMARY_NAV } from './nav-items';
import { cn } from '@/lib/cn';

export function Header(): JSX.Element {
  const { t } = useTranslation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-all duration-200',
        scrolled
          ? 'border-b border-border/60 bg-background/80 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="container flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {PRIMARY_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          <a
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:inline-flex"
            aria-label={`${t('footer.telegram')} (${BRAND.telegramHandle})`}
          >
            <Send className="h-4 w-4" />
            <span>{BRAND.telegramHandle}</span>
          </a>

          <LanguageSwitcher />
          <ThemeToggle />

          <div className="ml-1 hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm">
              <NavLink to="/auth/login">{t('nav.login')}</NavLink>
            </Button>
            <Button asChild variant="gradient" size="sm">
              <NavLink to="/auth/register">{t('nav.register')}</NavLink>
            </Button>
          </div>

          <MobileNav items={PRIMARY_NAV} />
        </div>
      </div>
    </header>
  );
}
