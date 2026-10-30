import * as React from 'react';
import { cn } from '@lib/utils';

const Tabs = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & {
    value: string;
    onValueChange: (value: string) => void;
    defaultValue?: string;
    orientation?: 'horizontal' | 'vertical';
  }
>(({ className, value, onValueChange, defaultValue, orientation = 'horizontal', children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn('flex', orientation === 'vertical' ? 'flex-col' : '', className)}
      data-orientation={orientation}
      {...props}
    >
      {children}
    </div>
  );
});
Tabs.displayName = 'Tabs';

const TabsList = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
        className
      )}
      role="tablist"
      aria-orientation="horizontal"
      {...props}
    >
      {children}
    </div>
  );
});
TabsList.displayName = 'TabsList';

const TabsTrigger = React.forwardRef<
  React.ElementRef<'button'>,
  React.ComponentPropsWithoutRef<'button'> & {
    value: string;
    disabled?: boolean;
  }
>(({ className, value, disabled, children, ...props }, ref) => {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
        className
      )}
      role="tab"
      aria-selected={false}
      data-state="inactive"
      data-disabled={disabled}
      data-value={value}
      onClick={() => {}}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
});
TabsTrigger.displayName = 'TabsTrigger';

const TabsContent = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & {
    value: string;
    forceMount?: boolean;
  }
>(({ className, value, forceMount, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className
      )}
      role="tabpanel"
      data-value={value}
      {...props}
    >
      {children}
    </div>
  );
});
TabsContent.displayName = 'TabsContent';

export { Tabs, TabsList, TabsTrigger, TabsContent };