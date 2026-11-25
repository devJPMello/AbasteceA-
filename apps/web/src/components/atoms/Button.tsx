import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'border border-border bg-card text-foreground hover:bg-muted',
        soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
        ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
        danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-5 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  variant,
  size,
  loading,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/** Icon-only button: `label` becomes the accessible name and the tooltip. */
export function IconButton({
  label,
  className,
  variant = 'ghost',
  ...rest
}: Omit<ButtonProps, 'size' | 'aria-label'> & { label: string }) {
  return (
    <Button
      variant={variant}
      size="icon"
      aria-label={label}
      title={label}
      className={className}
      {...rest}
    />
  );
}
