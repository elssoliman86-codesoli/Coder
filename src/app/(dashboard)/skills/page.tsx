'use client';

import { useState } from 'react';
import { Sidebar } from '@components/layout/Sidebar';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Badge } from '@components/ui/badge';
import { Textarea } from '@components/ui/textarea';
import { Separator } from '@components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@components/ui/dialog';
import { Switch } from '@components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Copy,
  Download,
  Upload,
  Code,
  Brain,
  Zap,
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@lib/utils';

interface Skill {
  id: string;
  name: string;
  description: string;
  category: 'code' | 'analysis' | 'security' | 'devops' | 'custom';
  prompt: string;
  parameters?: Record<string, { type: string; description: string; required: boolean }>;
  enabled: boolean;
  builtIn: boolean;
  version: string;
  author?: string;
  tags: string[];
}

const builtInSkills: Skill[] = [
  {
    id: 'code-review',
    name: 'مراجعة الكود',
    description: 'تحليل الكود للعثور على أخطاء، تحسينات، وأفضل الممارسات',
    category: 'code',
    prompt: `أنت خبير في مراجعة الكود. قم بتحليل الكود المقدم وابحث عن:
1. أخطاء محتملة (Bugs)
2. مشاكل الأداء (Performance issues)
3. ثغرات أمنية (Security vulnerabilities)
4. مخالفات لأفضل الممارسات (Best practices violations)
5. اقتراحات للتحسين (Improvement suggestions)

قدم تقريراً منظماً مع درجة الخطورة لكل نقطة.`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      focus: { type: 'string', description: 'مجال التركيز (security, performance, style)', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['review', 'quality', 'security'],
  },
  {
    id: 'generate-tests',
    name: 'توليد الاختبارات',
    description: 'إنشاء اختبارات وحدة شاملة للكود المحدد',
    category: 'code',
    prompt: `قم بإنشاء اختبارات وحدة شاملة للكود المقدم. يجب أن تتضمن الاختبارات:
1. اختبارات الحالات الطبيعية (Happy path)
2. اختبارات الحالات الحدية (Edge cases)
3. اختبارات معالجة الأخطاء (Error handling)
4. استخدام مكتبات الاختبار المناسبة للغة

غطِ أكبر قدر ممكن من الكود.`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      framework: { type: 'string', description: 'إطار الاختبار (jest, pytest, etc.)', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['testing', 'tdd', 'quality'],
  },
  {
    id: 'refactor',
    name: 'إعادة هيكلة الكود',
    description: 'تحسين بنية الكود دون تغيير سلوكه الخارجي',
    category: 'code',
    prompt: `قم بإعادة هيكلة الكود المقدم لتحسين:
1. قابلية القراءة والصيانة
2. الأداء
3. اتباع مبادئ SOLID
4. إزالة التكرار (DRY)
5. تحسين الأسماء والبنية

احتفظ بالسلوك الخارجي نفسه تماماً.`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      target: { type: 'string', description: 'هدف إعادة الهيكلة', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['refactor', 'clean-code', 'maintainability'],
  },
  {
    id: 'security-audit',
    name: 'تدقيق أمني',
    description: 'فحص الكود بحثاً عن ثغرات أمنية شائعة',
    category: 'security',
    prompt: `قم بتدقيق أمني شامل للكود المقدم. ابحث عن:
1. حقن SQL / NoSQL
2. XSS (Cross-site scripting)
3. CSRF
4. مشاكل المصادقة والتفويض
5. تسرب البيانات الحساسة
6. مكونات ضعيفة/قديمة
7. إعدادات غير آمنة

صنف كل ثغرة حسب معيار CVSS.`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      framework: { type: 'string', description: 'الإطار المستخدم', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['security', 'audit', 'vulnerability'],
  },
  {
    id: 'dockerfile',
    name: 'إنشاء Dockerfile',
    description: 'إنشاء Dockerfile محسّن للمشروع',
    category: 'devops',
    prompt: `قم بإنشاء Dockerfile محسّن للمشروع المقدم. يجب أن يتضمن:
1. استخدام صورة أساسية خفيفة (Alpine/Distroless)
2. البناء متعدد المراحل (Multi-stage build)
3. تخزين مؤقت فعال للتبعيات
4. مستخدم غير جذر للأمان
5. متغيرات بيئة مناسبة
6. Health check
7. تحسين حجم الصورة النهائي`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      framework: { type: 'string', description: 'الإطار المستخدم', required: false },
      port: { type: 'string', description: 'المنفذ المكشوف', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['docker', 'containerization', 'devops'],
  },
  {
    id: 'api-docs',
    name: 'توثيق API',
    description: 'إنشاء توثيق OpenAPI/Swagger للكود',
    category: 'code',
    prompt: `قم بإنشاء توثيق OpenAPI 3.0 شامل للـ API المقدم. يجب أن يتضمن:
1. معلومات عامة (info, servers)
2. جميع المسارات (paths) مع المعاملات
3. نماذج البيانات (schemas)
4. أمثلة للطلبات والاستجابات
5. رموز الاستجابة والأخطاء
6. متطلبات المصادقة`,
    parameters: {
      language: { type: 'string', description: 'لغة البرمجة', required: true },
      framework: { type: 'string', description: 'إطار العمل (Express, FastAPI, etc.)', required: false },
    },
    enabled: true,
    builtIn: true,
    version: '1.0.0',
    tags: ['documentation', 'openapi', 'swagger'],
  },
];

const categoryLabels: Record<string, string> = {
  code: 'الكود',
  analysis: 'التحليل',
  security: 'الأمان',
  devops: 'DevOps',
  custom: 'مخصص',
};

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  code: Code,
  analysis: Brain,
  security: AlertCircle,
  devops: Zap,
  custom: FileText,
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('coder-skills');
      if (saved) {
        try {
          return [...builtInSkills, ...JSON.parse(saved)];
        } catch {
          return builtInSkills;
        }
      }
    }
    return builtInSkills;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<Skill>>({
    name: '',
    description: '',
    category: 'custom',
    prompt: '',
    enabled: true,
    tags: '',
  });

  const filteredSkills = skills.filter(skill => {
    const matchesSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || skill.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSaveSkill = async () => {
    if (!formData.name || !formData.prompt) return;
    setSaving(true);
    try {
      const newSkill: Skill = {
        id: editingSkill?.id || `custom-${Date.now()}`,
        name: formData.name,
        description: formData.description || '',
        category: formData.category as Skill['category'],
        prompt: formData.prompt,
        enabled: formData.enabled ?? true,
        builtIn: false,
        version: editingSkill ? editingSkill.version : '1.0.0',
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      if (editingSkill) {
        setSkills(prev => prev.map(s => s.id === editingSkill.id ? newSkill : s));
      } else {
        setSkills(prev => [...prev, newSkill]);
      }

      // Save custom skills to localStorage
      const customSkills = skills.filter(s => !s.builtIn);
      localStorage.setItem('coder-skills', JSON.stringify(customSkills));

      setShowCreateDialog(false);
      setEditingSkill(null);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'custom',
      prompt: '',
      enabled: true,
      tags: '',
    });
  };

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill);
    setFormData({
      name: skill.name,
      description: skill.description,
      category: skill.category,
      prompt: skill.prompt,
      enabled: skill.enabled,
      tags: skill.tags.join(', '),
    });
    setShowCreateDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('هل أنت متأكد من حذف هذه المهارة؟')) {
      setSkills(prev => prev.filter(s => s.id !== id));
      const customSkills = skills.filter(s => !s.builtIn && s.id !== id);
      localStorage.setItem('coder-skills', JSON.stringify(customSkills));
    }
  };

  const handleExport = () => {
    const customSkills = skills.filter(s => !s.builtIn);
    const blob = new Blob([JSON.stringify(customSkills, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coder-skills.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          const newSkills = imported.map((s: any) => ({
            ...s,
            id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            builtIn: false,
          }));
          setSkills(prev => [...prev, ...newSkills]);
          localStorage.setItem('coder-skills', JSON.stringify([...skills.filter(s => !s.builtIn), ...newSkills]));
        }
      } catch {
        alert('ملف غير صالح');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        projects={[]}
        onSelectProject={() => {}}
        onNewProject={() => {}}
        onOpenFolder={() => {}}
        isMobileOpen={false}
        onCloseMobile={() => {}}
      />

      <div className="lg:pl-64 flex-1">
        <div className="max-w-6xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <Brain className="h-8 w-8 text-primary" aria-hidden="true" />
                المهارات
              </h1>
              <p className="text-muted-foreground mt-1">إدارة مهارات الذكاء الاصطناعي المخصصة والمدمجة</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" aria-hidden="true" />
                تصدير
              </Button>
              <label className="button cursor-pointer" style={{ display: 'flex', alignItems: 'center' }}>
                <Button variant="outline" className="gap-2">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  استيراد
                </Button>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="sr-only"
                  aria-label="استيراد المهارات"
                />
              </label>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    مهارة جديدة
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingSkill ? 'تعديل المهارة' : 'إنشاء مهارة جديدة'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="skill-name">الاسم</Label>
                      <Input
                        id="skill-name"
                        value={formData.name || ''}
                        onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="مثال: مراجعة الكود بلغة Python"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-description">الوصف</Label>
                      <Input
                        id="skill-description"
                        value={formData.description || ''}
                        onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="وصف مختصر لما تفعله المهارة"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-category">الفئة</Label>
                      <Select value={formData.category || 'custom'} onValueChange={v => setFormData(prev => ({ ...prev, category: v }))}>
                        <SelectTrigger id="skill-category">
                          <SelectValue placeholder="اختر الفئة" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(categoryLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-prompt">النظام الموجه (System Prompt)</Label>
                      <Textarea
                        id="skill-prompt"
                        value={formData.prompt || ''}
                        onChange={e => setFormData(prev => ({ ...prev, prompt: e.target.value }))}
                        placeholder="اكتب التعليمات التي سيتبعها النموذج عند استخدام هذه المهارة..."
                        rows={8}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="skill-tags">الوسوم (مفصولة بفواصل)</Label>
                      <Input
                        id="skill-tags"
                        value={formData.tags || ''}
                        onChange={e => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="testing, python, quality"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>مفعلة</Label>
                        <p className="text-sm text-muted-foreground">تظهر في قائمة المهارات المتاحة</p>
                      </div>
                      <Switch
                        checked={formData.enabled ?? true}
                        onCheckedChange={v => setFormData(prev => ({ ...prev, enabled: v }))}
                      />
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); setEditingSkill(null); }}>
                      إلغاء
                    </Button>
                    <Button onClick={handleSaveSkill} disabled={saving} className="gap-2">
                      {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {editingSkill ? 'تحديث' : 'إنشاء'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                placeholder="البحث في المهارات..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={activeCategory} onValueChange={v => setActiveCategory(v)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="جميع الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Skills Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                لا توجد مهارات مطابقة للبحث
              </div>
            ) : (
              filteredSkills.map(skill => {
                const Icon = categoryIcons[skill.category] || FileText;
                return (
                  <Card key={skill.id} className={cn('flex flex-col', !skill.enabled && 'opacity-50 border-border/50')}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className={cn('p-2 rounded-lg', skill.builtIn ? 'bg-primary/10 text-primary' : 'bg-secondary text-secondary-foreground')}>
                            <Icon className="h-4 w-4" aria-hidden="true" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <CardTitle className="text-lg truncate">{skill.name}</CardTitle>
                              {skill.builtIn && (
                                <Badge variant="default" size="sm">مدمجة</Badge>
                              )}
                              {!skill.enabled && (
                                <Badge variant="secondary" size="sm">معطلة</Badge>
                              )}
                            </div>
                            <Badge variant="outline" size="sm" className="mt-1">
                              {categoryLabels[skill.category] || skill.category}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEdit(skill)}
                            disabled={skill.builtIn}
                            aria-label="تعديل"
                          >
                            <Edit className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          {!skill.builtIn && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(skill.id)}
                              aria-label="حذف"
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{skill.description}</p>
                      <div className="flex flex-wrap gap-1 mt-3">
                        {skill.tags.slice(0, 4).map(tag => (
                          <Badge key={tag} variant="outline" size="sm">{tag}</Badge>
                        ))}
                        {skill.tags.length > 4 && (
                          <Badge variant="outline" size="sm">+{skill.tags.length - 4}</Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">v{skill.version}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 h-8"
                          onClick={() => navigator.clipboard.writeText(skill.prompt)}
                          aria-label="نسخ البرومبت"
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="text-xs">نسخ البرومبت</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}