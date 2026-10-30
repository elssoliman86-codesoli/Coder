'use client';

import { forwardRef } from 'react';
import { cn } from '@lib/utils';
import { X } from 'lucide-react';

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'success' | 'warning';
}

export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variants = {
      default: 'border-border bg-card text-card-foreground',
      destructive: 'border-destructive/50 bg-destructive/10 text-destructive',
      success: 'border-green-500/50 bg-green-500/10 text-green-500',
      warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500',
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Alert.displayName = 'Alert';

export const AlertTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
);

AlertTitle.displayName = 'AlertTitle';

export const AlertDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('text-sm [&_p]:leading-relaxed', className)}
      {...props}
    />
  )
);

AlertDescription.displayName = 'AlertDescription';

interface AlertActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClose: () => void;
}

export const AlertAction = forwardRef<HTMLButtonElement, AlertActionProps>(
  ({ className, onClose, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'absolute right-4 top-4 rounded-md p-1 text-foreground/50 hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        className
      )}
      onClick={onClose}
      aria-label="إغلاق التنبيه"
      {...props}
    >
      <X className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  )
);

AlertAction.displayName = 'AlertAction';