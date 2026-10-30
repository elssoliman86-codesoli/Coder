import { Button } from '@components/ui/button';
import { Menu, Sun, Moon, Settings, ChevronLeft, ChevronRight, Code2, FilePlus } from 'lucide-react';
import { useStore, useSettings } from '@app/store';
import { cn } from '@lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  showMenu?: boolean;
}

export function Header({ onMenuClick, showMenu = true }: HeaderProps) {
  const { settings, toggleTheme, toggleLanguage } = useSettings();
  const { sidebarOpen, setSidebarOpen, newProject } = useStore();

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-30',
      'bg-background/80 backdrop-blur-lg border-b border-border',
      'transition-all duration-300'
    )}>
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            {showMenu && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onMenuClick}
                className="lg:hidden"
                aria-label="فتح القائمة"
              >
                <Menu className="h-5 w-5" />
              </Button>
            )}

            <div className="flex items-center gap-2">
              <Code2 className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl font-arabic">OneByte Coder</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={settings.theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
              className="transition-colors"
            >
              {settings.theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              aria-label={settings.language === 'ar' ? 'التبديل للإنجليزية' : 'التبديل للعربية'}
              className="transition-colors"
            >
              <span className="text-xs font-medium">
                {settings.language === 'ar' ? 'EN' : 'ع'}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="فتح الإعدادات"
            >
              <Settings className="h-5 w-5" />
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={newProject}
              className="hidden sm:flex gap-2"
            >
              <FilePlus className="h-4 w-4" />
              <span>مشروع جديد</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}