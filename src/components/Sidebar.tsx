'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  Settings,
  Menu,
  X,
  ChevronRight,
  Code,
  Brain,
  Bot,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Skills', href: '/skills', icon: Brain },
  { name: 'Agent', href: '/agent', icon: Bot },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-background border shadow"
        onClick={() => setIsMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-screen bg-card border-r transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-16' : 'w-64',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        aria-label="Main navigation"
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between h-16 px-4 border-b', isCollapsed && 'justify-center')}>
          <Link href="/" className="flex items-center gap-2" aria-label="Go to dashboard">
            <Code className="w-6 h-6 text-primary" />
            {!isCollapsed && <span className="font-bold text-lg">Coder</span>}
          </Link>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn('p-1.5 rounded-lg hover:bg-accent transition-colors', isCollapsed && 'hidden')}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
          >
            <ChevronRight className={cn('w-4 h-4 transition-transform', isCollapsed && 'rotate-180')} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  isCollapsed && 'justify-center'
                )}
                aria-current={isActive ? 'page' : undefined}
                title={isCollapsed ? item.name : undefined}
                onClick={() => setIsMobileOpen(false)}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {!isCollapsed && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn('p-3 border-t', isCollapsed && 'hidden')}>
          <div className="text-xs text-muted-foreground text-center">
            v1.0.0
          </div>
        </div>
      </aside>
    </>
  );
}