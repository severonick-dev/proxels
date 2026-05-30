import { cn } from '@/lib/cn';

interface Props {
  title: string;
  subtitle?: string;
  note?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageStub({ title, subtitle, note, children, className }: Props): JSX.Element {
  return (
    <section className={cn('container py-16 md:py-24', className)}>
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
        {children && <div className="mt-8">{children}</div>}
        {note && (
          <p className="mt-10 rounded-lg border border-dashed border-border bg-card/50 px-4 py-3 text-xs text-muted-foreground/80">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}
