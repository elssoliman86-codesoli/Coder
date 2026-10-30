import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@lib/utils';

export function Toaster() {
  return (
    <ToastProvider>
      <ToastViewport className="fixed bottom-0 right-0 flex flex-col p-4 sm:bottom-4 sm:right-4 sm:flex-row gap-2 z-50" />
      <style>{`
        [data-radix-toast-viewport] {
          --radix-toast-swipe-end-x: 50%;
          --radix-toast-swipe-end-y: 0%;
        }
      `}</style>
    </ToastProvider>
  );
}

interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

export function ToastComponent({ title, description, variant = 'default', ...props }: ToastProps & React.ComponentPropsWithoutRef<typeof Toast>) {
  const variants = {
    default: 'bg-background text-foreground border-border',
    destructive: 'bg-destructive/90 text-destructive-foreground border-destructive/50',
    success: 'bg-green-500/90 text-green-500-foreground border-green-500/50'
  };

  return (
    <Toast
      {...props}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-8 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full',
        variants[variant]
      )}
    >
      <div className="grid gap-1">
        {title && <ToastTitle className="text-sm font-semibold">{title}</ToastTitle>}
        {description && <ToastDescription className="text-sm opacity-90">{description}</ToastDescription>}
      </div>
      <ToastClose
        className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
        toastClose=""
      >
        <X className="h-4 w-4" />
      </ToastClose>
    </Toast>
  );
}

export function toast({ title, description, variant = 'default' }: ToastProps) {
  // This is a simplified version - in production you'd use a proper toast library
  // or implement a toast context/hook
  console.log('Toast:', { title, description, variant });
}