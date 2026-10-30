import { useNavigate } from 'react-router-dom';
import { Button } from '@components/ui/button';
import { Menu, Sun, Moon, Settings, Code2, FilePlus } from 'lucide-react';
import { useStore, useSettings } from '@app/store';
import { cn } from '@lib/utils';

interface HeaderProps { onMenuClick: () => void; showMenu?: boolean; }

export function Header({ onMenuClick, showMenu = true }: HeaderProps) {
  const navigate = useNavigate();
  const settings = useSettings();
  const updateSettings = useStore(s => s.updateSettings);
  const toggleTheme = () => updateSettings({theme:settings.theme==='dark'?'light':'dark'});
  const toggleLanguage = () => updateSettings({language:settings.language==='ar'?'en':'ar'});

  return (
    <header className={cn('fixed top-0 left-0 right-0 z-30 safe-top bg-background/80 backdrop-blur-lg border-b border-border transition-all duration-300')}>
      <div className="container mx-auto px-4"><div className="flex h-16 items-center justify-between">
        <div className="flex items-center gap-4">
          {showMenu && <Button variant="ghost" size="icon" onClick={onMenuClick} className="lg:hidden" aria-label="فتح القائمة"><Menu className="h-5 w-5"/></Button>}
          <div className="flex items-center gap-2"><Code2 className="h-6 w-6 text-primary"/><span className="font-bold text-xl">OneByte Coder</span></div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="تغيير المظهر">{settings.theme==='dark'?<Sun className="h-5 w-5"/>:<Moon className="h-5 w-5"/>}</Button>
          <Button variant="ghost" size="sm" onClick={toggleLanguage}>{settings.language==='ar'?'EN':'ع'}</Button>
          <Button variant="ghost" size="icon" onClick={()=>navigate('/settings')} aria-label="الإعدادات"><Settings className="h-5 w-5"/></Button>
          <Button variant="primary" size="sm" onClick={()=>navigate('/new-project')} className="hidden gap-2 sm:flex"><FilePlus className="h-4 w-4"/><span>مشروع جديد</span></Button>
        </div>
      </div></div>
    </header>
  );
}
