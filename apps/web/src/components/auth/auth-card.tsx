import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

interface Props {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ title, subtitle, footer, children, className }: Props): JSX.Element {
  return (
    <section className="container flex min-h-[80dvh] items-center justify-center py-12">
      <div className={cn('w-full max-w-md space-y-6', className)}>
        <div className="flex justify-center">
          <Logo />
        </div>

        <div className="rounded-2xl border border-border bg-card/70 p-7 backdrop-blur-sm">
          <div className="mb-5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}

        <p className="text-center text-xs text-muted-foreground/70">
          <Link to="/legal/privacy" className="hover:text-foreground">
            Политика
          </Link>
          {' · '}
          <Link to="/legal/offer" className="hover:text-foreground">
            Оферта
          </Link>
        </p>
      </div>
    </section>
  );
}
