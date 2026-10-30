'use client';

import { Skill, SkillCategory } from '../types/skill';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Download,
  Check,
  ExternalLink,
  Shield,
  Globe,
  Terminal,
  FileCode,
  Database,
  Zap,
} from 'lucide-react';

interface SkillCardProps {
  skill: Skill;
  installed?: boolean;
  onInstall?: (id: string) => void;
  onUninstall?: (id: string) => void;
  onExecute?: (id: string) => void;
  loading?: boolean;
}

const categoryIcons: Record<SkillCategory, React.ComponentType<{ className?: string }>> = {
  security: Shield,
  development: FileCode,
  analysis: Database,
  automation: Zap,
  testing: Terminal,
  documentation: Globe,
  deployment: ExternalLink,
  utility: Download,
};

const categoryLabels: Record<SkillCategory, string> = {
  security: 'أمان',
  development: 'تطوير',
  analysis: 'تحليل',
  automation: 'أتمتة',
  testing: 'اختبار',
  documentation: 'توثيق',
  deployment: 'نشر',
  utility: 'أدوات',
};

const categoryColors: Record<SkillCategory, BadgeProps['variant']> = {
  security: 'destructive',
  development: 'primary',
  analysis: 'success',
  automation: 'warning',
  testing: 'secondary',
  documentation: 'outline',
  deployment: 'primary',
  utility: 'secondary',
};

export function SkillCard({
  skill,
  installed = false,
  onInstall,
  onUninstall,
  onExecute,
  loading = false,
}: SkillCardProps) {
  const CategoryIcon = categoryIcons[skill.category] || Download;
  const categoryColor = categoryColors[skill.category] || 'default';

  return (
    <div className={cn(
      'group relative bg-card border border-border rounded-xl p-5 transition-all',
      'hover:border-primary/50 hover:shadow-lg',
      installed && 'border-primary/30 bg-primary/5'
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn(
            'flex items-center justify-center w-11 h-11 rounded-xl shrink-0',
            `bg-${categoryColor.replace('destructive', 'red')}-100 text-${categoryColor.replace('destructive', 'red')}-600`
          )}>
            <CategoryIcon className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg truncate">{skill.name}</h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <Badge variant={categoryColor} size="sm">{categoryLabels[skill.category]}</Badge>
              <span>v{skill.version}</span>
              {skill.author && <span>• {skill.author}</span>}
            </div>
          </div>
        </div>
        {skill.verified && (
          <span className="flex items-center gap-1 text-xs text-green-600 shrink-0" title="مهارة موثقة">
            <Check className="w-3 h-3" aria-hidden="true" />
            موثق
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
        {skill.description}
      </p>

      {/* Tags */}
      {skill.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4" aria-label="وسوم المهارة">
          {skill.tags.slice(0, 4).map((tag) => (
            <Badge key={tag} variant="outline" size="sm" className="text-[10px] px-1.5">
              {tag}
            </Badge>
          ))}
          {skill.tags.length > 4 && (
            <Badge variant="outline" size="sm" className="text-[10px] px-1.5">
              +{skill.tags.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Permissions */}
      {skill.manifest.permissions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
            <Shield className="w-3 h-3" aria-hidden="true" />
            الصلاحيات المطلوبة:
          </div>
          <div className="flex flex-wrap gap-1">
            {skill.manifest.permissions.slice(0, 3).map((perm) => (
              <Badge key={perm} variant="outline" size="sm" className="text-[10px] px-1.5">
                {perm}
              </Badge>
            ))}
            {skill.manifest.permissions.length > 3 && (
              <Badge variant="outline" size="sm" className="text-[10px] px-1.5">
                +{skill.manifest.permissions.length - 3}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        {installed ? (
          <>
            <button
              onClick={() => onExecute?.(skill.id)}
              disabled={loading}
              className="flex-1 btn btn-primary btn-sm"
              aria-label={`تشغيل ${skill.name}`}
            >
              <Terminal className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              تشغيل
            </button>
            <button
              onClick={() => onUninstall?.(skill.id)}
              disabled={loading}
              className="btn btn-outline btn-sm"
              aria-label={`إلغاء تثبيت ${skill.name}`}
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onInstall?.(skill.id)}
            disabled={loading}
            className="flex-1 btn btn-primary btn-sm"
            aria-label={`تثبيت ${skill.name}`}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
            تثبيت
          </button>
        )}
      </div>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-background/80 rounded-xl flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

// Re-export BadgeProps for categoryColors
type BadgeProps = import('@/components/ui/badge').BadgeProps;