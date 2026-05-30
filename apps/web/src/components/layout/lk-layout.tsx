import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CreditCard, LayoutDashboard, LogOut, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { cn } from '@/lib/cn';

interface LkNavItem {
  to: string;
  labelKey: string;
  end?: boolean;
  Icon: typeof LayoutDashboard;
}

const ITEMS: LkNavItem[] = [
  { to: '/lk', end: true, labelKey: 'lk.nav.dashboard', Icon: LayoutDashboard },
  { to: '/lk/payments', labelKey: 'lk.nav.payments', Icon: CreditCard },
  { to: '/lk/settings', labelKey: 'lk.nav.settings', Icon: Settings },
];

export function LkLayout(): JSX.Element {
  const { t } = useTranslation();
  const { user, clear } = useAuthStore();

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clear();
    toast.success(t('lk.toast.loggedOut'));
  };

  return (
    <div className="container py-10 md:py-14">
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <aside className="space-y-1.5">
          {user && (
            <div className="mb-5 rounded-xl border border-border bg-card p-3 text-sm">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {t('lk.signedInAs')}
              </div>
              <div className="mt-0.5 truncate font-medium" title={user.email}>
                {user.email}
              </div>
            </div>
          )}
          <nav aria-label="Личный кабинет">
            {ITEMS.map(({ to, labelKey, Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-secondary text-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </NavLink>
            ))}
          </nav>
          <div className="pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2.5"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              {t('nav.logout')}
            </Button>
          </div>
        </aside>

        <section>
          <Outlet />
        </section>
      </div>
    </div>
  );
}
