import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';

interface Props {
  children: React.ReactNode;
  /** Если указано — требует не только auth, но и эту роль. */
  requireRole?: 'user' | 'admin';
}

/**
 * Гард на маршруты /lk, /admin. Полагается на auth-store.
 * - loading → спиннер на весь экран
 * - anon → редирект на /auth/login с ?return=<current>
 * - auth + role mismatch → редирект на /
 */
export function ProtectedRoute({ children, requireRole }: Props): JSX.Element {
  const { status, user } = useAuthStore();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'anon' || !user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/auth/login?return=${returnTo}`} replace />;
  }

  if (requireRole && user.role !== requireRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
