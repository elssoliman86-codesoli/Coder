import { cn } from '@lib/utils';

export function LoadingScreen() {
  return (
    <div
      className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300')}
      role="status"
      aria-label="جاري التحميل"
    >
      <div className="flex flex-col items-center gap-4">
        <svg className="h-12 w-12 animate-spin text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l-2.647z" />
        </svg>
        <p className="text-sm font-medium text-muted-foreground">جاري تحميل التطبيق...</p>
      </div>
    </div>
  );
}
