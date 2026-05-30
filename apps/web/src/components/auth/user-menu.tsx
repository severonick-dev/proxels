import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircleUserRound, LayoutDashboard, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/auth-store';
import { apiRequest } from '@/lib/api';

export function UserMenu(): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  if (!user) return <></>;

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore */
    }
    clear();
    toast.success(t('lk.toast.loggedOut'));
    navigate('/', { replace: true });
  };

  const initials = (user.email[0] ?? '?').toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label={t('nav.lk')}
          title={user.email}
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-gradient text-xs font-bold text-white">
            {initials}
          </span>
          <span className="hidden max-w-[140px] truncate text-xs text-muted-foreground sm:inline">
            {user.email}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/lk')}>
          <LayoutDashboard className="mr-2 h-4 w-4" />
          {t('nav.lk')}
        </DropdownMenuItem>
        {user.role === 'admin' && (
          <DropdownMenuItem onSelect={() => navigate('/admin')}>
            <CircleUserRound className="mr-2 h-4 w-4" />
            {t('nav.admin')}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t('nav.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
