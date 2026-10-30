'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@lib/utils';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Code,
  Brain,
  Bot,
  Plus,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  FolderPlus,
  Search,
  History,
  Globe,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  path: string;
  lastOpened: string;
  language?: string;
}

interface SidebarProps {
  projects: Project[];
  currentProjectId?: string;
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onOpenFolder: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

const navigation = [
  { name: 'لوحة التحكم', href: '/', icon: LayoutDashboard },
  { name: 'المشاريع', href: '/projects', icon: FolderOpen },
  { name: 'المهارات', href: '/skills', icon: Brain },
  { name: 'الوكيل', href: '/agent', icon: Bot },
  { name: 'الإعدادات', href: '/settings', icon: Settings },
];

export function Sidebar({
  projects,
  currentProjectId,
  onSelectProject,
  onNewProject,
  onOpenFolder,
  isMobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    projects: true,
    recent: true,
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <>
      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed lg:static z-50 h-full w-64 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        role="navigation"
        aria-label="القائمة الجانبية"
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
          <Link href="/" className="flex items-center gap-2" onClick={onCloseMobile}>
            <Code className="h-6 w-6 text-primary" aria-hidden="true" />
            <span className="font-bold text-lg">Coder</span>
          </Link>
          <button
            className="lg:hidden p-2 rounded-md hover:bg-accent"
            onClick={onCloseMobile}
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1" role="navigation" aria-label="التنقل الرئيسي">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Projects Section */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => toggleSection('projects')}
              className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded"
              aria-expanded={expandedSections.projects}
              aria-controls="projects-list"
            >
              <FolderOpen className="h-4 w-4" aria-hidden="true" />
              المشاريع
              <ChevronDown
                className={cn('h-3 w-3 transition-transform', expandedSections.projects && 'rotate-180')}
                aria-hidden="true"
              />
            </button>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onNewProject}
                aria-label="مشروع جديد"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onOpenFolder}
                aria-label="فتح مجلد"
              >
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {expandedSections.projects && (
            <div id="projects-list" className="space-y-1" role="list" aria-label="قائمة المشاريع">
              {projects.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                  لا توجد مشاريع بعد
                </div>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onSelectProject(project.id);
                      onCloseMobile();
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                      currentProjectId === project.id
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    )}
                    role="listitem"
                    aria-current={currentProjectId === project.id ? 'true' : 'false'}
                  >
                    <FolderOpen className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate flex-1">{project.name}</span>
                    {project.language && (
                      <Badge variant="outline" size="sm" className="hidden sm:inline-flex">
                        {project.language}
                      </Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Recent Projects */}
          <button
            onClick={() => toggleSection('recent')}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded mt-4"
            aria-expanded={expandedSections.recent}
            aria-controls="recent-list"
          >
            <span className="flex items-center gap-2">
              <History className="h-4 w-4" aria-hidden="true" />
              مؤخراً
            </span>
            <ChevronDown
              className={cn('h-3 w-3 transition-transform', expandedSections.recent && 'rotate-180')}
              aria-hidden="true"
            />
          </button>

          {expandedSections.recent && (
            <div id="recent-list" className="space-y-1 mt-1" role="list" aria-label="المشاريع الحديثة">
              {projects.slice(0, 5).map((project) => (
                <button
                  key={`recent-${project.id}`}
                  onClick={() => {
                    onSelectProject(project.id);
                    onCloseMobile();
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-2"
                  role="listitem"
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate flex-1">{project.name}</span>
                  <span className="text-[10px] text-muted-foreground/50">
                    {new Date(project.lastOpened).toLocaleDateString('ar-EG')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Link
            href="https://github.com/elssoliman86-codesoli/Coder"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            onClick={onCloseMobile}
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>GitHub</span>
            <ChevronRight className="h-3 w-3 ml-auto" aria-hidden="true" />
          </Link>
        </div>
      </aside>
    </>
  );
}