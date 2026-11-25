import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        warning: 'bg-warning/15 text-warning',
        success: 'bg-success/15 text-success',
        danger: 'bg-destructive/15 text-destructive',
        cheap: 'bg-band-cheap/15 text-band-cheap',
        mid: 'bg-band-mid/15 text-band-mid',
        expensive: 'bg-band-expensive/15 text-band-expensive',
        none: 'bg-band-none/15 text-muted-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export function Badge({
  tone,
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...rest} />;
}
