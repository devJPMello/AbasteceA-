import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  titleAs: Title = 'p',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Heading level when this is the main content of a page (otherwise a plain paragraph). */
  titleAs?: 'p' | 'h1' | 'h2' | 'h3';
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-10 text-center', className)}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <Title className="font-semibold">{title}</Title>
      {description && <p className="max-w-xs text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  );
}
