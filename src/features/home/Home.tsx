import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FilePlus, FolderOpen, Settings, Code2, Database, Globe, Terminal, Smartphone, Laptop, LayoutDashboard } from 'lucide-react';
import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useStore } from '@app/store';
import { cn, getLanguageIcon, getLanguageColor } from '@lib/utils';

const LANGUAGE_ICONS: Record<string, React.ReactNode> = {
  typescript: <Code2 className="h-5 w-5 text-blue-400" />,
  javascript: <Code2 className="h-5 w-5 text-yellow-400" />,
  python: <Code2 className="h-5 w-5 text-green-400" />,
  dart: <Smartphone className="h-5 w-5 text-cyan-400" />,
  kotlin: <Smartphone className="h-5 w-5 text-purple-400" />,
  java: <Code2 className="h-5 w-5 text-red-400" />,
  csharp: <Code2 className="h-5 w-5 text-purple-400" />,
  go: <Code2 className="h-5 w-5 text-cyan-400" />,
  rust: <Code2 className="h-5 w-5 text-orange-400" />,
  cpp: <Code2 className="h-5 w-5 text-blue-400" />,
  c: <Code2 className="h-5 w-5 text-blue-400" />,
  php: <Code2 className="h-5 w-5 text-purple-400" />,
  html: <Globe className="h-5 w-5 text-orange-400" />,
  css: <LayoutDashboard className="h-5 w-5 text-blue-400" />,
  shell: <Terminal className="h-5 w-5 text-green-400" />,
  sql: <Database className="h-5 w-5 text-orange-400" />,
  json: <Code2 className="h-5 w-5 text-yellow-400" />,
  yaml: <Code2 className="h-5 w-5 text-red-400" />,
  markdown: <FilePlus className="h-5 w-5 text-gray-400" />,
};

const TYPE_ICONS: Record<string, React.ReactNode> = {
  website: <Globe className="h-5 w-5" />,
  apk: <Smartphone className="h-5 w-5" />,
  cli: <Terminal className="h-5 w-5" />,
  exe: <Laptop className="h-5 w-5" />,
  library: <Code2 className="h-5 w-5" />,
};

const TYPE_LABELS: Record<string, string> = {
  website: 'موقع ويب',
  apk: 'تطبيق أندرويد',
  cli: 'أداة سطر أوامر',
  exe: 'تطبيق سطح مكتب',
  library: 'مكتبة',
};

export function Home() {
  const navigate = useNavigate();
  const { projects, newProject, deleteProject } = useStore();
  const [showNewProject, setShowNewProject] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const projectList = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleNewProject = () => {
    newProject();
    navigate('/new-project');
  };

  const handleOpenProject = (projectId: string) => {
    navigate(`/workspace/${projectId}`);
  };

  const handleDeleteProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (confirm('هل أنت متأكد من حذف هذا المشروع؟')) {
      deleteProject(projectId);
    }
  };

  if (projectList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="glass-card rounded-2xl p-12 max-w-md mx-4">
          <Code2 className="h-16 w-16 text-primary/50 mx-auto mb-6" />
          <h2 className="text-2xl font-bold mb-2 font-arabic">لا توجد مشاريع بعد</h2>
          <p className="text-muted-foreground mb-6 font-arabic">
            ابدأ بإنشاء مشروع جديد أو استيراد كود موجود
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={handleNewProject} size="lg">
              <Plus className="h-5 w-5" />
              <span className="font-arabic">مشروع جديد</span>
            </Button>
            <Button variant="outline" onClick={() => setShowImport(true)} size="lg">
              <FolderOpen className="h-5 w-5" />
              <span className="font-arabic">استيراد مشروع</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-arabic">مشاريعي</h1>
          <p className="text-muted-foreground font-arabic">
            {projectList.length} مشروع{projectList.length !== 1 ? 'اً' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <FolderOpen className="h-4 w-4" />
            <span className="font-arabic">استيراد</span>
          </Button>
          <Button onClick={handleNewProject}>
            <Plus className="h-4 w-4" />
            <span className="font-arabic">مشروع جديد</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {projectList.map((project) => (
          <Card
            key={project.id}
            variant="hover"
            onClick={() => handleOpenProject(project.id)}
            className="cursor-pointer h-full flex flex-col"
          >
            <div className="flex items-start justify-between p-4">
              <div className="flex items-center gap-3">
                {TYPE_ICONS[project.type] || <Code2 className="h-5 w-5" />}
                <div>
                  <h3 className="font-semibold font-arabic truncate max-w-[200px]">{project.name}</h3>
                  <p className="text-sm text-muted-foreground font-arabic capitalize">{TYPE_LABELS[project.type]}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => handleDeleteProject(e, project.id)}
                className="text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="حذف المشروع"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </Button>
            </div>

            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground font-arabic line-clamp-2">{project.description}</p>

              <div className="flex flex-wrap gap-2">
                {project.languages.slice(0, 4).map((lang) => (
                  <Badge key={lang} variant="outline" className={cn('gap-1', getLanguageColor(lang))}>
                    {LANGUAGE_ICONS[lang] || <Code2 className="h-3 w-3" />}
                    <span className="font-arabic text-xs capitalize">{lang}</span>
                  </Badge>
                ))}
                {project.languages.length > 4 && (
                  <Badge variant="secondary" className="font-arabic">
                    +{project.languages.length - 4}
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span className="font-arabic">
                  {project.files.length} ملف{project.files.length !== 1 ? 'اً' : ''}
                </span>
                <span className="font-arabic">
                  تم التحديث {formatRelativeTime(project.updatedAt)}
                </span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `منذ ${days} يوم`;
  if (hours > 0) return `منذ ${hours} ساعة`;
  if (minutes > 0) return `منذ ${minutes} دقيقة`;
  return 'الآن';
}