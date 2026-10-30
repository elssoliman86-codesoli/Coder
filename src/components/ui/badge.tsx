import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';
  size?: 'sm' | 'md';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    const variants = {
      default: 'bg-secondary text-secondary-foreground',
      primary: 'bg-primary/10 text-primary',
      secondary: 'bg-secondary text-secondary-foreground',
      success: 'bg-green-500/10 text-green-500',
      warning: 'bg-yellow-500/10 text-yellow-500',
      destructive: 'bg-destructive/10 text-destructive',
      outline: 'border border-border bg-transparent'
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-[11px]',
      md: 'px-2.5 py-0.5 text-xs'
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full font-medium transition-colors',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';