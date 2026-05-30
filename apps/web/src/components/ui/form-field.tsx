import * as React from 'react';
import { cn } from '@/lib/cn';
import { Label } from './label';

interface FormFieldProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Минимальный wrapper для поля формы: label сверху, контролы, под ним hint/error.
 * Подходит для Input/Textarea/Select. Для checkbox использовать прямой Label inline.
 */
export function FormField({
  id,
  label,
  error,
  hint,
  className,
  children,
}: FormFieldProps): JSX.Element {
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {React.isValidElement(children)
        ? React.cloneElement(
            children as React.ReactElement<{
              id?: string;
              'aria-describedby'?: string;
              'aria-invalid'?: boolean;
            }>,
            {
              id,
              'aria-describedby': describedBy,
              'aria-invalid': !!error,
            },
          )
        : children}
      {error ? (
        <p id={`${id}-err`} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
