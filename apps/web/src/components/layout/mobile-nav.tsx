import { useState } from 'react';
import { LayoutDashboard, LogOut, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Logo } from '@/components/brand/logo';
import { BRAND } from '@proxels/shared';
import { cn } from '@/lib/cn';
import type { NavItem } from './nav-items';
import { useAuthStore } from '@/stores/auth-store';
import { apiRequest } from '@/lib/api';

interface Props {
  items: NavItem[];
  isAuthed?: boolean;
}

export function MobileNav({ items, isAuthed }: Props): JSX.Element {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clear();
    setOpen(false);
    toast.success(t('lk.toast.loggedOut'));
    navigate('/', { replace: true });
  };

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
          {isAuthed && user ? (
            <>
              <div className="rounded-lg bg-secondary px-3 py-2 text-xs">
                <div className="text-muted-foreground">{t('lk.signedInAs')}</div>
                <div className="mt-0.5 truncate font-medium">{user.email}</div>
              </div>
              <SheetClose asChild>
                <Button asChild variant="gradient">
                  <NavLink to="/lk">
                    <LayoutDashboard className="h-4 w-4" /> {t('nav.lk')}
                  </NavLink>
                </Button>
              </SheetClose>
              <Button variant="ghost" className="justify-start gap-2" onClick={logout}>
                <LogOut className="h-4 w-4" /> {t('nav.logout')}
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
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
