import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, Pencil, Plus, Trash2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/cn';

interface NewsPost {
  id: string;
  slug: string;
  title: string;
  summary: string;
  contentMd: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NewsFormState {
  slug: string;
  title: string;
  summary: string;
  contentMd: string;
  publish: boolean;
}

const EMPTY: NewsFormState = {
  slug: '',
  title: '',
  summary: '',
  contentMd: '',
  publish: true,
};

export default function AdminNewsPage(): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<NewsPost | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<NewsFormState>(EMPTY);

  const newsQ = useQuery({
    queryKey: ['admin', 'news'],
    queryFn: () => apiRequest<NewsPost[]>('/admin/news'),
  });

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setForm(EMPTY);
  };
  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  };
  const openEdit = (n: NewsPost) => {
    setCreating(false);
    setEditing(n);
    setForm({
      slug: n.slug,
      title: n.title,
      summary: n.summary,
      contentMd: n.contentMd,
      publish: n.publishedAt !== null,
    });
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest<NewsPost>('/admin/news', { method: 'POST', body }),
    onSuccess: () => {
      toast.success(t('admin.news.toast.created'));
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiRequest<NewsPost>(`/admin/news/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast.success(t('admin.news.toast.updated'));
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
      closeForm();
    },
    onError: (err) => toast.error((err as Error).message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/news/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success(t('admin.news.toast.deleted'));
      void qc.invalidateQueries({ queryKey: ['admin', 'news'] });
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      contentMd: form.contentMd,
      publish: form.publish,
    };
    if (!editing) body.slug = form.slug.trim();
    if (editing) {
      updateMutation.mutate({ id: editing.id, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const pending = createMutation.isPending || updateMutation.isPending;
  const locale = i18n.resolvedLanguage ?? 'ru';
  const dialogOpen = creating || editing !== null;

  return (
    <>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {t('admin.news.title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('admin.news.subtitle', { count: newsQ.data?.length ?? 0 })}
          </p>
        </div>
        <Button onClick={openCreate} variant="gradient">
          <Plus className="h-4 w-4" /> {t('admin.news.add')}
        </Button>
      </header>

      {newsQ.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> {t('pages.pricing.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">{t('admin.news.cols.title')}</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">{t('admin.news.cols.published')}</th>
                <th className="px-4 py-3 font-medium">{t('admin.news.cols.updated')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('admin.news.cols.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {newsQ.data?.map((n) => (
                <tr
                  key={n.id}
                  className={cn(
                    'border-b border-border/60 last:border-b-0',
                    !n.publishedAt && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground">{n.summary}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs">{n.slug}</td>
                  <td className="px-4 py-2.5">
                    {n.publishedAt ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(n.updatedAt).toLocaleDateString(locale)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.news.actions.edit')}
                        onClick={() => openEdit(n)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        title={t('admin.news.actions.delete')}
                        onClick={() => {
                          if (window.confirm(t('admin.news.confirmDelete', { title: n.title }))) {
                            deleteMutation.mutate(n.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeForm()}>
        <DialogContent className="max-w-3xl">
          <DialogTitle>
            {editing ? t('admin.news.dialog.editTitle') : t('admin.news.dialog.createTitle')}
          </DialogTitle>
          <form onSubmit={submit} className="grid gap-4 pt-2">
            {!editing && (
              <div>
                <Label htmlFor="news-slug">Slug</Label>
                <Input
                  id="news-slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    })
                  }
                  maxLength={64}
                  required
                  placeholder="my-first-post"
                  className="font-mono"
                />
              </div>
            )}
            <div>
              <Label htmlFor="news-title">{t('admin.news.fields.title')}</Label>
              <Input
                id="news-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                maxLength={160}
                required
              />
            </div>
            <div>
              <Label htmlFor="news-summary">{t('admin.news.fields.summary')}</Label>
              <Input
                id="news-summary"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                maxLength={320}
                required
              />
            </div>
            <div>
              <Label htmlFor="news-content">{t('admin.news.fields.content')}</Label>
              <textarea
                id="news-content"
                value={form.contentMd}
                onChange={(e) => setForm({ ...form, contentMd: e.target.value })}
                required
                rows={14}
                className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                placeholder="## Заголовок&#10;&#10;Текст в markdown..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t('admin.news.fields.contentHint')}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.publish}
                onChange={(e) => setForm({ ...form, publish: e.target.checked })}
              />
              {t('admin.news.fields.publish')}
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={closeForm} disabled={pending}>
                {t('admin.news.cancel')}
              </Button>
              <Button type="submit" variant="gradient" disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? t('admin.news.save') : t('admin.news.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
