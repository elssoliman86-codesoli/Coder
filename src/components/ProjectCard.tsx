'use client';

import { FolderGit2, Clock, Trash2, MoreHorizontal, Edit2, Play, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@lib/utils';
import { Badge } from '@/components/ui/badge';

export interface Project {
  id: string;
  name: string;
  description?: string;
  path: string;
  framework?: string;
  language?: string;
  lastOpened: string;
  createdAt: string;
  isFavorite?: boolean;
}

interface ProjectCardProps {
  project: Project;
  onOpen: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  onDuplicate: (project: Project) => void;
}

export function ProjectCard({ project, onOpen, onEdit, onDelete, onDuplicate }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays} يوم`;
    if (diffHours > 0) return `${diffHours} ساعة`;
    if (diffMinutes > 0) return `${diffMinutes} دقيقة`;
    return 'الآن';
  };

  const getFrameworkColor = (framework?: string) => {
    if (!framework) return 'default';
    const fw = framework.toLowerCase();
    if (fw.includes('react') || fw.includes('next')) return 'primary';
    if (fw.includes('vue') || fw.includes('nuxt')) return 'success';
    if (fw.includes('angular')) return 'destructive';
    if (fw.includes('svelte')) return 'warning';
    return 'default';
  };

  return (
    <div className="group relative bg-card border border-border rounded-xl p-4 transition-all hover:border-primary/50 hover:shadow-lg">
      {/* Header with favorite and menu */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <FolderGit2 className="text-muted-foreground" size={20} />
          <h3 className="font-semibold text-foreground truncate max-w-[200px]">{project.name}</h3>
          {project.isFavorite && (
            <span className="text-yellow-500" aria-label="مفضل">★</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
            aria-label="خيارات المشروع"
            aria-expanded={showMenu}
          >
            <MoreHorizontal size={18} />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[140px]">
                <button
                  onClick={() => { onOpen(project); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                >
                  <Play size={16} /> فتح المشروع
                </button>
                <button
                  onClick={() => { onEdit(project); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                >
                  <Edit2 size={16} /> إعادة تسمية
                </button>
                <button
                  onClick={() => { onDuplicate(project); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent flex items-center gap-2"
                >
                  <Copy size={16} /> نسخ
                </button>
                <hr className="my-1 border-border" />
                <button
                  onClick={() => { onDelete(project); setShowMenu(false); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-accent text-destructive flex items-center gap-2"
                >
                  <Trash2 size={16} /> حذف
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
      )}

      {/* Meta info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1">
          <Clock size={12} /> آخر فتح: {formatDate(project.lastOpened)}
        </span>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 flex-wrap">
        {project.framework && (
          <Badge variant={getFrameworkColor(project.framework) as any} size="sm">
            {project.framework}
          </Badge>
        )}
        {project.language && (
          <Badge variant="outline" size="sm">
            {project.language}
          </Badge>
        )}
      </div>

      {/* Action buttons on hover */}
      <div className="mt-4 pt-3 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
        <button
          onClick={() => onOpen(project)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Play size={14} /> فتح
        </button>
        <button
          onClick={() => onEdit(project)}
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
          aria-label="تعديل"
        >
          <Edit2 size={16} />
        </button>
      </div>
    </div>
  );
}