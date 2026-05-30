import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

interface Props {
  className?: string;
}

export function Logo({ className }: Props): JSX.Element {
  return (
    <Link
      to="/"
      className={cn(
        'group inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight',
        className,
      )}
      aria-label="Proxels"
    >
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white shadow-[0_8px_24px_-12px_hsl(252_84%_56%/0.8)] transition-transform group-hover:-translate-y-0.5"
      >
        <span className="text-base font-extrabold">P</span>
      </span>
      <span className="text-foreground">
        Proxels<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
