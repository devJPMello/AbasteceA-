import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Toggle chip (filter). Exposes its state with aria-pressed. */
export function Chip({
  selected,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-medium transition-colors',
        selected
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted',
        className,
      )}
      {...rest}
    />
  );
}
