import type { InputHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

const field =
  'h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors disabled:opacity-60';

export function Input({
  invalid,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(field, invalid ? 'border-destructive' : 'border-input', className)}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={cn(field, 'pr-8', invalid ? 'border-destructive' : 'border-input', className)}
      {...rest}
    />
  );
}
