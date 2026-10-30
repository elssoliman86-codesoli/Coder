import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Globe, Smartphone, Terminal, Laptop, Code2, Database, Plus, Loader2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Card } from '@components/ui/card';
import { Badge } from '@components/ui/badge';
import { Textarea } from '@components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useStore } from '@app/store';
import { cn, generateId } from '@lib/utils';

const PROJECT_TYPES = [
  { id: 'website', label: 'موقع ويب', icon: Globe, description: 'تطبيق ويب متجاوب (React, Vue, Next.js, إلخ)' },
  { id: 'apk', label: 'تطبيق أندرويد', icon: Smartphone, description: 'تطبيق جوال أصلي أو هجين (Capacitor, React Native, Flutter)' },
  { id: 'cli', label: 'أداة سطر أوامر', icon: Terminal, description: 'أداة CLI (Node.js, Go, Rust, Python)' },
  { id: 'exe', label: 'تطبيق سطح مكتب', icon: Laptop, description: 'تطبيق ديسكتوب (Electron, Tauri, .NET, PyQt)' },
  { id: 'library', label: 'مكتبة/حزمة', icon: Code2, description: 'مكتبة قابلة لإعادة الاستخدام (npm, PyPI, Cargo, Maven)' },
];

const LANGUAGES = [
  'typescript', 'javascript', 'python', 'dart', 'kotlin', 'java',
  'csharp', 'go', 'rust', 'cpp', 'c', 'php', 'html', 'css', 'shell', 'sql'
];

const FRAMEWORKS: Record<string, string[]> = {
  website: ['React', 'Next.js', 'Vue', 'Nuxt', 'Svelte', 'Astro', 'Remix', 'Vanilla'],
  apk: ['Capacitor', 'React Native', 'Flutter', 'Native (Kotlin)', 'Ionic'],
  cli: ['Node.js (Commander)', 'Go (Cobra)', 'Rust (Clap)', 'Python (Click/Typer)', 'Bash'],
  exe: ['Electron', 'Tauri', 'PyQt/PySide', '.NET MAUI', 'Swing/JavaFX'],
  library: ['TypeScript/JS (npm)', 'Python (PyPI)', 'Rust (Cargo)', 'Go (modules)', 'Java (Maven/Gradle)'],
};

const DATABASES = ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Redis', 'Supabase', 'Firebase', 'None'];

export function NewProjectDialog() {
  const navigate = useNavigate();
  const { newProject } = useStore();
  
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'website',
    primaryLanguage: 'typescript',
    languages: ['typescript'],
    framework: '',
    database: 'None',
    features: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);

  // Reset form on mount
  useEffect(() => {
    setFormData({
      name: '',
      description: '',
      type: 'website',
      primaryLanguage: 'typescript',
      languages: ['typescript'],
      framework: '',
      database: 'None',
      features: [],
    });
    setStep(1);
  }, []);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLanguageToggle = (lang: string) => {
    setFormData(prev => {
      const langs = prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang];
      return { ...prev, languages: langs, primaryLanguage: langs[0] || 'typescript' };
    });
  };

  const handleFeatureToggle = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }));
  };

  const handleNext = () => {
    if (step === 1 && !formData.name.trim()) return;
    if (step === 2 && !formData.type) return;
    setStep(prev => Math.min(prev + 1, 3));
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.type) return;
    
    setIsCreating(true);
    
    try {
      const project = await newProject({
        ...formData,
        id: generateId(),
        files: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      navigate(`/workspace/${project.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('فشل إنشاء المشروع');
    } finally {
      setIsCreating(false);
    }
  };

  const currentType = PROJECT_TYPES.find(t => t.id === formData.type);
  const availableFrameworks = FRAMEWORKS[formData.type] || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => step > 1 ? handleBack() : navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="font-bold text-lg font-arabic">مشروع جديد</h2>
              <p className="text-sm text-muted-foreground font-arabic">
                الخطوة {step} من 3
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(s => (
              <div
                key={s}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  s < step ? 'bg-primary text-primary-foreground' :
                  s === step ? 'bg-primary/20 text-primary border border-primary' :
                  'bg-muted text-muted-foreground'
                )}
              >
                {s < step ? <span className="h-4 w-4" /> : s}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="space-y-4" data-step="1">
              <div>
                <label className="block text-sm font-medium font-arabic mb-2">اسم المشروع</label>
                <Input
                  placeholder="مثال: متجر إلكتروني، تطبيق مهام، أداة تحليل..."
                  value={formData.name}
                  onChange={e => handleChange('name', e.target.value)}
                  className="font-arabic"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium font-arabic mb-2">الوصف</label>
                <Textarea
                  placeholder="صف فكرة المشروع بإيجاز..."
                  value={formData.description}
                  onChange={e => handleChange('description', e.target.value)}
                  className="font-arabic"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Type & Stack */}
          {step === 2 && (
            <div className="space-y-6" data-step="2">
              <div>
                <label className="block text-sm font-medium font-arabic mb-3">نوع المشروع</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PROJECT_TYPES.map(type => (
                    <Card
                      key={type.id}
                      variant={formData.type === type.id ? 'primary' : 'hover'}
                      onClick={() => handleChange('type', type.id)}
                      className={cn('cursor-pointer p-3 text-center', formData.type === type.id && 'ring-2 ring-primary')}
                    >
                      <type.icon className="h-8 w-8 mx-auto mb-2" style={{ color: formData.type === type.id ? 'white' : 'inherit' }} />
                      <h4 className="font-medium font-arabic">{type.label}</h4>
                      <p className="text-xs text-muted-foreground font-arabic mt-1 line-clamp-2">{type.description}</p>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium font-arabic mb-3">اللغات البرمجية</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <Badge
                      key={lang}
                      variant={formData.languages.includes(lang) ? 'primary' : 'outline'}
                      onClick={() => handleLanguageToggle(lang)}
                      className="cursor-pointer gap-1"
                    >
                      <Code2 className="h-3 w-3" />
                      <span className="font-arabic text-xs capitalize">{lang}</span>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium font-arabic mb-2">الإطار (Framework)</label>
                  <Select value={formData.framework} onValueChange={v => handleChange('framework', v)}>
                    <SelectTrigger className="font-arabic">
                      <SelectValue placeholder="اختر إطار عمل" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFrameworks.map(fw => (
                        <SelectItem key={fw} value={fw}>
                          <span className="font-arabic">{fw}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium font-arabic mb-2">قاعدة البيانات</label>
                  <Select value={formData.database} onValueChange={v => handleChange('database', v)}>
                    <SelectTrigger className="font-arabic">
                      <SelectValue placeholder="اختر قاعدة البيانات" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATABASES.map(db => (
                        <SelectItem key={db} value={db}>
                          <span className="font-arabic">{db}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Features & Confirm */}
          {step === 3 && (
            <div className="space-y-6" data-step="3">
              <div>
                <label className="block text-sm font-medium font-arabic mb-3">ميزات إضافية</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'auth', 'api', 'realtime', 'payments', 'notifications',
                    'analytics', 'search', 'file-upload', 'email', 'caching',
                    'testing', 'ci-cd', 'docker', 'pwa', 'i18n'
                  ].map(feature => (
                    <Card
                      key={feature}
                      variant={formData.features.includes(feature) ? 'primary' : 'outline'}
                      onClick={() => handleFeatureToggle(feature)}
                      className="cursor-pointer p-3 flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" style={{ color: formData.features.includes(feature) ? 'white' : 'inherit' }} />
                      <span className="font-arabic text-sm capitalize">{feature.replace('-', ' ')}</span>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-xl p-4 border border-border/50">
                <h4 className="font-medium font-arabic mb-3">ملخص المشروع</h4>
                <dl className="space-y-2 text-sm font-arabic">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">الاسم</dt>
                    <dd className="font-medium">{formData.name || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">النوع</dt>
                    <dd className="font-medium">{currentType?.label || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">اللغات</dt>
                    <dd className="font-medium">{formData.languages.join(', ')}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">الإطار</dt>
                    <dd className="font-medium">{formData.framework || '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">قاعدة البيانات</dt>
                    <dd className="font-medium">{formData.database}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">الميزات</dt>
                    <dd className="font-medium">{formData.features.length} محددة</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/50 flex items-center justify-end gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={isCreating}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="font-arabic">رجوع</span>
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={handleNext} disabled={isCreating || (step === 1 && !formData.name.trim())}>
              <span className="font-arabic">التالي</span>
              <svg className="h-4 w-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isCreating} className="gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              <Plus className="h-4 w-4" />
              <span className="font-arabic">إنشاء المشروع</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}