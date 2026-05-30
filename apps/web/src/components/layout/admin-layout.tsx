import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  CreditCard,
  FileText,
  History,
  Layers,
  Newspaper,
  ScrollText,
  Server,
  Tag,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/stores/auth-store';
import { SEO } from '@/components/seo/seo';

interface NavItem {
  to: string;
  labelKey: string;
  Icon: typeof Users;
  end?: boolean;
}

const ITEMS: NavItem[] = [
  { to: '/admin', end: true, labelKey: 'admin.nav.overview', Icon: History },
  { to: '/admin/users', labelKey: 'admin.nav.users', Icon: Users },
  { to: '/admin/plans', labelKey: 'admin.nav.plans', Icon: Layers },
  { to: '/admin/payments', labelKey: 'admin.nav.payments', Icon: CreditCard },
  { to: '/admin/promos', labelKey: 'admin.nav.promos', Icon: Tag },
  { to: '/admin/nodes', labelKey: 'admin.nav.nodes', Icon: Server },
  { to: '/admin/guides', labelKey: 'admin.nav.guides', Icon: BookOpen },
  { to: '/admin/news', labelKey: 'admin.nav.news', Icon: Newspaper },
  { to: '/admin/legal', labelKey: 'admin.nav.legal', Icon: FileText },
  { to: '/admin/audit', labelKey: 'admin.nav.audit', Icon: ScrollText },
];

export function AdminLayout(): JSX.Element {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  return (
    <>
      <SEO title="Admin" description="Admin panel" path="/admin" noindex />
      <div className="container py-10 md:py-14">
        <div className="grid gap-8 md:grid-cols-[220px_1fr]">
          <aside className="space-y-1.5">
            {user && (
              <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-primary">
                  {t('admin.panelLabel')}
                </div>
                <div className="mt-0.5 truncate font-medium" title={user.email}>
                  {user.email}
                </div>
              </div>
            )}
            <nav aria-label="Admin">
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
          </aside>

          <section>
            <Outlet />
          </section>
        </div>
      </div>
    </>
  );
}
