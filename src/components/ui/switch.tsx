'use client';

import { forwardRef } from 'react';
import { cn } from '@lib/utils';

export interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, id, ...props }, ref) => {
    const switchId = id || `switch-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="flex items-center gap-3">
        <div className="relative inline-flex items-center">
          <input
            type="checkbox"
            role="switch"
            className={cn(
              'peer h-6 w-6 appearance-none rounded-full border-2 border-border bg-background transition-all duration-200',
              'checked:border-primary checked:bg-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'after:content-[""] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-border after:transition-transform after:duration-200',
              'peer-checked:after:translate-x-full peer-checked:after:bg-white',
              className
            )}
            id={switchId}
            ref={ref}
            {...props}
          />
        </div>
        {label && (
          <label
            htmlFor={switchId}
            className="text-sm font-medium text-foreground cursor-pointer select-none"
          >
            {label}
          </label>
        )}
      </div>
    );
  }
);

Switch.displayName = 'Switch';