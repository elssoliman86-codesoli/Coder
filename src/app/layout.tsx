import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from '@components/layout/Sidebar';
import { Header } from '@components/layout/Header';
import { useStore, useSettings } from '@app/store';
import { cn } from '@lib/utils';

export function Layout() {
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen } = useStore();
  const settings = useSettings();

  useEffect(() => {
    document.documentElement.setAttribute('dir', settings.language === 'ar' ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', settings.language);
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const applyTheme = () => document.documentElement.classList.toggle('light', settings.theme === 'light' || (settings.theme === 'system' && media.matches));
    applyTheme();
    if (settings.theme !== 'system') return;
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [settings.theme, settings.language]);

  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <div className={cn('min-h-screen bg-background flex', 'font-arabic')}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className={cn('flex-1 flex flex-col min-w-0', 'lg:pr-64')}>
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className={cn('flex-1 overflow-auto p-4 md:p-6 lg:p-8', isWorkspace ? 'pt-[calc(4rem+env(safe-area-inset-top))]' : 'pt-[calc(5rem+env(safe-area-inset-top))]')}>
          <Outlet />
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </div>
  );
}