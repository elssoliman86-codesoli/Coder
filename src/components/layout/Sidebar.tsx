import { NavLink } from 'react-router-dom';
import { Code2, FolderKanban, Settings, X } from 'lucide-react';
import { cn } from '@lib/utils';

type Props = { isOpen: boolean; onClose: () => void };

export function Sidebar({ isOpen, onClose }: Props) {
  const links = [
    { to: '/', label: 'المشاريع', icon: FolderKanban, end: true },
    { to: '/settings', label: 'الإعدادات', icon: Settings, end: false }
  ];
  return (
    <aside className={cn('fixed inset-y-0 right-0 z-50 flex w-64 flex-col border-l border-border bg-card transition-transform lg:translate-x-0', isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0')}>
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2 font-bold"><Code2 className="h-6 w-6 text-primary" /> 2OneByte</div>
        <button className="rounded-lg p-2 hover:bg-accent lg:hidden" onClick={onClose} aria-label="إغلاق القائمة"><X size={18}/></button>
      </div>
      <nav className="space-y-2 p-3">
        {links.map(({to,label,icon:Icon,end}) => <NavLink key={to} to={to} end={end} onClick={onClose} className={({isActive}) => cn('flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors',isActive?'bg-primary/10 text-primary':'text-muted-foreground hover:bg-accent hover:text-foreground')}><Icon size={18}/>{label}</NavLink>)}
      </nav>
      <div className="mt-auto border-t border-border p-4 text-xs text-muted-foreground">بيئة تطوير محلية • نسخة تجريبية</div>
    </aside>
  );
}
