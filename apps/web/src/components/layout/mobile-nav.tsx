import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/brand/logo';
import { BRAND } from '@proxels/shared';
import { cn } from '@/lib/cn';
import type { NavItem } from './nav-items';

interface Props {
  items: NavItem[];
}

export function MobileNav({ items }: Props): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('nav.openMenu')}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <Logo />
          <SheetTitle className="sr-only">{t('nav.openMenu')}</SheetTitle>
        </div>

        <nav aria-label="Mobile navigation" className="flex flex-col gap-1 pt-2">
          {items.map((item) => (
            <SheetClose asChild key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2.5 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                {t(item.labelKey)}
              </NavLink>
            </SheetClose>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
          <SheetClose asChild>
            <NavLink
              to="/auth/login"
              className="rounded-lg px-3 py-2.5 text-base font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {t('nav.login')}
            </NavLink>
          </SheetClose>
          <SheetClose asChild>
            <Button asChild variant="gradient">
              <NavLink to="/auth/register">{t('nav.register')}</NavLink>
            </Button>
          </SheetClose>
          <a
            href={BRAND.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm font-medium hover:bg-accent"
          >
            <span className="text-primary">↗</span> {t('footer.telegram')}
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}
