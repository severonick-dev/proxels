import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, ShieldOff, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface UserRow {
  id: string;
  email: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  twofaEnabled: boolean;
  createdAt: string;
  deletedAt: string | null;
  _count: { subscriptions: number; payments: number };
}

interface UsersList {
  total: number;
  skip: number;
  take: number;
  items: UserRow[];
}

export default function AdminUsersPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const take = 25;

  const usersQ = useQuery({
    queryKey: ['admin', 'users', q, page],
    queryFn: () =>
      apiRequest<UsersList>(
        `/admin/users?take=${take}&skip=${page * take}${q ? `&q=${encodeURIComponent(q)}` : ''}`,
      ),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/users/${id}/revoke-sessions`, { method: 'POST' }),
    onSuccess: () => toast.success(t('admin.users.toast.sessionsRevoked')),
    onError: (err) => toast.error((err as Error).message),
  });
  const verifyMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/users/${id}/force-verify`, { method: 'POST' }),
    onSuccess: () => {
      toast.success(t('admin.users.toast.verified'));
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('admin.users.toast.deleted'));
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const locale = i18n.resolvedLanguage ?? 'ru';

  return (
    <>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{t('admin.users.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('admin.users.subtitle', { count: usersQ.data?.total ?? 0 })}
        </p>
      </header>

      <div className="mb-4">
        <Input
          placeholder={t('admin.users.searchPlaceholder')}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          className="max-w-sm"
        />
      </div>

      {usersQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.cols.role')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.cols.verified')}</th>
                <th className="px-4 py-3 font-medium">2FA</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.cols.subs')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.cols.payments')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.users.cols.created')}</th>
                <th className="px-4 py-3 font-medium text-right">
                  {t('admin.users.cols.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {usersQ.data?.items.map((u) => (
                <tr
                  key={u.id}
                  className={cn(
                    'border-b border-border/60 last:border-b-0',
                    u.deletedAt && 'opacity-50',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="truncate font-medium" title={u.email}>
                      {u.email}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">{u.id}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        u.role === 'admin'
                          ? 'bg-primary/15 text-primary'
                          : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {u.emailVerified ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.twofaEnabled ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5">{u._count.subscriptions}</td>
                  <td className="px-4 py-2.5">{u._count.payments}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.users.actions.revokeSessions')}
                        onClick={() => revokeMutation.mutate(u.id)}
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </Button>
                      {!u.emailVerified && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t('admin.users.actions.forceVerify')}
                          onClick={() => verifyMutation.mutate(u.id)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!u.deletedAt && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={t('admin.users.actions.delete')}
                          onClick={() => {
                            if (
                              window.confirm(t('admin.users.confirmDelete', { email: u.email }))
                            ) {
                              deleteMutation.mutate(u.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {t('admin.users.pageInfo', {
            from: page * take + 1,
            to: Math.min(page * take + take, usersQ.data?.total ?? 0),
            total: usersQ.data?.total ?? 0,
          })}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            ←
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={(page + 1) * take >= (usersQ.data?.total ?? 0)}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </Button>
        </div>
      </div>
    </>
  );
}
