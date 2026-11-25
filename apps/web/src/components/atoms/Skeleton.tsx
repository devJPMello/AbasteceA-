import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

/** Placeholder block with a shimmer. Decorative: hidden from assistive tech. */
export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton h-4 w-full', className)} {...rest} />;
}
