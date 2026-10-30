'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@components/layout/Sidebar';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/tabs';
import { Switch } from '@components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { Separator } from '@components/ui/separator';
import { Alert, AlertDescription } from '@components/ui/alert';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@lib/utils';

interface Settings {
  // General
  language: string;
  theme: 'light' | 'dark' | 'system';
  autoSave: boolean;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
  
  // AI Provider
  aiProvider: 'openai' | 'anthropic' | 'ollama' | 'custom';
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  
  // Agent
  agentEnabled: boolean;
  autoApprove: boolean;
  maxIterations: number;
  timeout: number;
  
  // Terminal
  shell: string;
  fontFamily: string;
  cursorBlink: boolean;
  
  // Git
  gitEnabled: boolean;
  autoFetch: boolean;
  signCommits: boolean;
}

const defaultSettings: Settings = {
  language: 'ar',
  theme: 'system',
  autoSave: true,
  fontSize: 14,
  tabSize: 2,
  wordWrap: true,
  minimap: true,
  lineNumbers: true,
  aiProvider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4000,
  agentEnabled: true,
  autoApprove: false,
  maxIterations: 10,
  timeout: 120000,
  shell: 'bash',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  cursorBlink: true,
  gitEnabled: true,
  autoFetch: true,
  signCommits: false,
};

const themes = [
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
  { value: 'system', label: 'النظام' },
];

const languages = [
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

const aiProviders = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-5-sonnet', 'claude-3-opus', 'claude-3-haiku'] },
  { value: 'ollama', label: 'Ollama (محلي)', models: ['llama3', 'codellama', 'mistral'] },
  { value: 'custom', label: 'مخصص', models: [] },
];

const shells = [
  { value: 'bash', label: 'Bash' },
  { value: 'zsh', label: 'Zsh' },
  { value: 'fish', label: 'Fish' },
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'CMD' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('coder-settings');
      if (saved) {
        try {
          return { ...defaultSettings, ...JSON.parse(saved) };
        } catch {
          return defaultSettings;
        }
      }
    }
    return defaultSettings;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('general');

  const handleChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      localStorage.setItem('coder-settings', JSON.stringify(settings));
      // Apply theme immediately
      if (typeof window !== 'undefined') {
        document.documentElement.setAttribute('data-theme', settings.theme);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('فشل في حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setError(null);
    if (!settings.apiKey) {
      setError('يرجى إدخال مفتاح API أولاً');
      return;
    }
    // In a real app, you would test the API connection here
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const provider = aiProviders.find(p => p.value === settings.aiProvider);

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
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">الإعدادات</h1>
              <p className="text-muted-foreground mt-1">
                تخصيص سلوك التطبيق ومظهره وتكاملات الذكاء الاصطناعي
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {saved ? <CheckCircle className="h-4 w-4 text-green-500" aria-hidden="true" /> : null}
              حفظ التغييرات
            </Button>
          </div>

          {error && (
            <Alert variant="destructive" className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {saved && !error && (
            <Alert className="border-green-500/50 bg-green-500/10 text-green-500" role="status">
              <CheckCircle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>تم حفظ الإعدادات بنجاح</AlertDescription>
            </Alert>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6" aria-label="أقسام الإعدادات">
              <TabsTrigger value="general">عام</TabsTrigger>
              <TabsTrigger value="editor">المحرر</TabsTrigger>
              <TabsTrigger value="ai">الذكاء الاصطناعي</TabsTrigger>
              <TabsTrigger value="agent">الوكيل</TabsTrigger>
              <TabsTrigger value="terminal">الطرفية</TabsTrigger>
              <TabsTrigger value="git">Git</TabsTrigger>
            </TabsList>

            {/* General */}
            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>عام</CardTitle>
                  <CardDescription>إعدادات التطبيق الأساسية</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="language">اللغة</Label>
                      <Select value={settings.language} onValueChange={v => handleChange('language', v)}>
                        <SelectTrigger id="language">
                          <SelectValue placeholder="اختر اللغة" />
                        </SelectTrigger>
                        <SelectContent>
                          {languages.map(lang => (
                            <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="theme">السمة</Label>
                      <Select value={settings.theme} onValueChange={v => handleChange('theme', v as Settings['theme'])}>
                        <SelectTrigger id="theme">
                          <SelectValue placeholder="اختر السمة" />
                        </SelectTrigger>
                        <SelectContent>
                          {themes.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>الحفظ التلقائي</Label>
                        <p className="text-sm text-muted-foreground">حفظ الملفات تلقائياً عند تغيير التبويب</p>
                      </div>
                      <Switch
                        checked={settings.autoSave}
                        onCheckedChange={v => handleChange('autoSave', v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Editor */}
            <TabsContent value="editor" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>المحرر</CardTitle>
                  <CardDescription>تخصيص تجربة التحرير</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fontSize">حجم الخط</Label>
                      <Input
                        id="fontSize"
                        type="number"
                        min="10"
                        max="24"
                        value={settings.fontSize}
                        onChange={e => handleChange('fontSize', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tabSize">حجم التبويب (مسافات)</Label>
                      <Input
                        id="tabSize"
                        type="number"
                        min="1"
                        max="8"
                        value={settings.tabSize}
                        onChange={e => handleChange('tabSize', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>تفكيك الأسطر (Word Wrap)</Label>
                        <p className="text-sm text-muted-foreground">تفكيك الأسطر الطويلة تلقائياً</p>
                      </div>
                      <Switch
                        checked={settings.wordWrap}
                        onCheckedChange={v => handleChange('wordWrap', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>الخريطة المصغرة (Minimap)</Label>
                        <p className="text-sm text-muted-foreground">عرض خريطة مصغرة للكود على الجانب</p>
                      </div>
                      <Switch
                        checked={settings.minimap}
                        onCheckedChange={v => handleChange('minimap', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>أرقام الأسطر</Label>
                        <p className="text-sm text-muted-foreground">عرض أرقام الأسطر في المحرر</p>
                      </div>
                      <Switch
                        checked={settings.lineNumbers}
                        onCheckedChange={v => handleChange('lineNumbers', v)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI */}
            <TabsContent value="ai" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>موفر الذكاء الاصطناعي</CardTitle>
                  <CardDescription>إعدادات الاتصال بنماذج اللغة الكبيرة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="aiProvider">الموفر</Label>
                    <Select value={settings.aiProvider} onValueChange={v => handleChange('aiProvider', v as Settings['aiProvider'])}>
                      <SelectTrigger id="aiProvider">
                        <SelectValue placeholder="اختر الموفر" />
                      </SelectTrigger>
                      <SelectContent>
                        {aiProviders.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">النموذج</Label>
                    <Select value={settings.model} onValueChange={v => handleChange('model', v)}>
                      <SelectTrigger id="model">
                        <SelectValue placeholder="اختر النموذج" />
                      </SelectTrigger>
                      <SelectContent>
                        {provider?.models.map(m => (
                          <SelectItem key={m} value={m}>{m}</SelectItem>
                        ))}
                        {settings.aiProvider === 'custom' && (
                          <SelectItem value="custom">أدخل يدوياً...</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="baseUrl">عنوان API الأساسي</Label>
                    <Input
                      id="baseUrl"
                      type="url"
                      value={settings.baseUrl}
                      onChange={e => handleChange('baseUrl', e.target.value)}
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="apiKey">مفتاح API</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={settings.apiKey}
                      onChange={e => handleChange('apiKey', e.target.value)}
                      placeholder="sk-..."
                      autoComplete="off"
                    />
                    <p className="text-sm text-muted-foreground">
                      مفتاح API الخاص بك. يتم تخزينه محلياً فقط.
                    </p>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="temperature">درجة الحرارة</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="temperature"
                          type="number"
                          min="0"
                          max="2"
                          step="0.1"
                          value={settings.temperature}
                          onChange={e => handleChange('temperature', parseFloat(e.target.value))}
                          className="w-24"
                        />
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={settings.temperature}
                          onChange={e => handleChange('temperature', parseFloat(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm text-muted-foreground w-10 text-right">
                          {settings.temperature.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxTokens">الحد الأقصى للرموز</Label>
                      <Input
                        id="maxTokens"
                        type="number"
                        min="100"
                        max="128000"
                        step="100"
                        value={settings.maxTokens}
                        onChange={e => handleChange('maxTokens', parseInt(e.target.value))}
                      />
                    </div>
                  </div>

                  <Button variant="outline" onClick={handleTestConnection} className="w-fit">
                    اختبار الاتصال
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Agent */}
            <TabsContent value="agent" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>إعدادات الوكيل</CardTitle>
                  <CardDescription>ضبط سلوك الوكيل المستقل</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>تفعيل الوكيل</Label>
                        <p className="text-sm text-muted-foreground">السماح للوكيل بتنفيذ المهام تلقائياً</p>
                      </div>
                      <Switch
                        checked={settings.agentEnabled}
                        onCheckedChange={v => handleChange('agentEnabled', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>الموافقة التلقائية</Label>
                        <p className="text-sm text-muted-foreground">تنفيذ الإجراءات دون طلب تأكيد</p>
                      </div>
                      <Switch
                        checked={settings.autoApprove}
                        onCheckedChange={v => handleChange('autoApprove', v)}
                        disabled={!settings.agentEnabled}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxIterations">الحد الأقصى للتكرارات</Label>
                      <Input
                        id="maxIterations"
                        type="number"
                        min="1"
                        max="50"
                        value={settings.maxIterations}
                        onChange={e => handleChange('maxIterations', parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeout">المهلة (ميلي ثانية)</Label>
                      <Input
                        id="timeout"
                        type="number"
                        min="10000"
                        max="600000"
                        step="10000"
                        value={settings.timeout}
                        onChange={e => handleChange('timeout', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Terminal */}
            <TabsContent value="terminal" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>الطرفية</CardTitle>
                  <CardDescription>إعدادات الطرفية المدمجة</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="shell">الصدفة الافتراضية</Label>
                    <Select value={settings.shell} onValueChange={v => handleChange('shell', v as Settings['shell'])}>
                      <SelectTrigger id="shell">
                        <SelectValue placeholder="اختر الصدفة" />
                      </SelectTrigger>
                      <SelectContent>
                        {shells.map(s => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fontFamily">عائلة الخط</Label>
                    <Input
                      id="fontFamily"
                      value={settings.fontFamily}
                      onChange={e => handleChange('fontFamily', e.target.value)}
                      placeholder="JetBrains Mono, Fira Code, monospace"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>وميض المؤشر</Label>
                      <p className="text-sm text-muted-foreground">إظهار وميض المؤشر في الطرفية</p>
                    </div>
                    <Switch
                      checked={settings.cursorBlink}
                      onCheckedChange={v => handleChange('cursorBlink', v)}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Git */}
            <TabsContent value="git" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Git</CardTitle>
                  <CardDescription>إعدادات التحكم بالإصدار</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>تفعيل Git</Label>
                        <p className="text-sm text-muted-foreground">عرض تغييرات Git في مستكشف الملفات</p>
                      </div>
                      <Switch
                        checked={settings.gitEnabled}
                        على تغيير={v => handleChange('gitEnabled', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>الجلب التلقائي</Label>
                        <p className="text-sm text-muted-foreground">جلب التحديثات من المستودع البعيد تلقائياً</p>
                      </div>
                      <Switch
                        checked={settings.autoFetch}
                        onCheckedChange={v => handleChange('autoFetch', v)}
                        disabled={!settings.gitEnabled}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>توقيع الالتزامات</Label>
                        <p className="text-sm text-muted-foreground">توقيع الالتزامات بمفتاح GPG</p>
                      </div>
                      <Switch
                        checked={settings.signCommits}
                        onCheckedChange={v => handleChange('signCommits', v)}
                        disabled={!settings.gitEnabled}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}