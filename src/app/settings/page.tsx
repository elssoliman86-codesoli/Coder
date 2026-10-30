'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/features/settings/hooks/useSettings';

const tabs = [
  { id: 'general', label: 'عام', icon: '🏠' },
  { id: 'editor', label: 'المحرر', icon: '⌨️' },
  { id: 'ai', label: 'الذكاء الاصطناعي', icon: '🤖' },
  { id: 'appearance', label: 'المظهر', icon: '🎨' },
  { id: 'advanced', label: 'متقدم', icon: '⚙️' },
] as const;

type TabId = typeof tabs[number]['id'];

interface SettingsForm {
  general: {
    defaultProjectPath: string;
    autoSave: boolean;
    confirmOnClose: boolean;
    telemetry: boolean;
  };
  editor: {
    fontSize: number;
    fontFamily: string;
    tabSize: number;
    wordWrap: 'on' | 'off' | 'wordWrapColumn';
    minimap: boolean;
    lineNumbers: 'on' | 'off' | 'relative';
    bracketMatching: boolean;
    autoClosingBrackets: boolean;
    formatOnSave: boolean;
    formatOnPaste: boolean;
  };
  ai: {
    provider: 'openai' | 'anthropic' | 'local' | 'custom';
    apiKey: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    enableInlineCompletion: boolean;
    enableChat: boolean;
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    density: 'comfortable' | 'compact';
    language: 'ar' | 'en';
    rtl: boolean;
  };
  advanced: {
    debugMode: boolean;
    logLevel: 'error' | 'warn' | 'info' | 'debug';
    experimentalFeatures: boolean;
    customCss: string;
  };
}

const defaultSettings: SettingsForm = {
  general: {
    defaultProjectPath: '',
    autoSave: true,
    confirmOnClose: true,
    telemetry: false,
  },
  editor: {
    fontSize: 14,
    fontFamily: 'JetBrains Mono, Fira Code, Consolas, monospace',
    tabSize: 2,
    wordWrap: 'on',
    minimap: true,
    lineNumbers: 'on',
    bracketMatching: true,
    autoClosingBrackets: true,
    formatOnSave: true,
    formatOnPaste: false,
  },
  ai: {
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'أنت مساعد برمجة خبير. اكتب كود نظيف وموثق.',
    enableInlineCompletion: true,
    enableChat: true,
  },
  appearance: {
    theme: 'system',
    accentColor: '#3b82f6',
    density: 'comfortable',
    language: 'ar',
    rtl: true,
  },
  advanced: {
    debugMode: false,
    logLevel: 'info',
    experimentalFeatures: false,
    customCss: '',
  },
};

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, isLoading, error } = useSettings();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [formData, setFormData] = useState<SettingsForm>(defaultSettings);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = useState(false);

  const currentTabSettings = settings[activeTab] || defaultSettings[activeTab];

  const handleChange = <K extends keyof SettingsForm[TabId]>(
    section: TabId,
    key: K,
    value: SettingsForm[TabId][K]
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value },
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await updateSettings(activeTab, formData[activeTab]);
      setSaveStatus('success');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const handleReset = async () => {
    if (!confirm('هل تريد إعادة تعيين إعدادات هذا القسم؟')) return;
    await resetSettings(activeTab);
    setFormData(prev => ({ ...prev, [activeTab]: defaultSettings[activeTab] }));
    setHasChanges(false);
  };

  const renderGeneral = () => (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>مسار المشاريع الافتراضي</CardTitle>
          <CardDescription>المجلد الذي سيتم فتحه افتراضياً عند إنشاء مشروع جديد</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="defaultProjectPath" className="block mb-2">المسار</Label>
          <Input
            id="defaultProjectPath"
            value={formData.general.defaultProjectPath}
            onChange={e => handleChange('general', 'defaultProjectPath', e.target.value)}
            placeholder="/home/user/projects"
            dir="ltr"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سلوك التطبيق</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>الحفظ التلقائي</Label>
              <p className="text-sm text-muted-foreground">حفظ الملفات تلقائياً عند فقدان التركيز</p>
            </div>
            <Switch
              checked={formData.general.autoSave}
              onCheckedChange={v => handleChange('general', 'autoSave', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>تأكيد عند الإغلاق</Label>
              <p className="text-sm text-muted-foreground">طلب التأكيد عند وجود تغييرات غير محفوظة</p>
            </div>
            <Switch
              checked={formData.general.confirmOnClose}
              onCheckedChange={v => handleChange('general', 'confirmOnClose', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>إرسال بيانات الاستخدام</Label>
              <p className="text-sm text-muted-foreground">مساعدتنا في تحسين التطبيق (مجهول)</p>
            </div>
            <Switch
              checked={formData.general.telemetry}
              onCheckedChange={v => handleChange('general', 'telemetry', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderEditor = () => (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>الخط والحجم</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fontSize">حجم الخط</Label>
              <Input
                id="fontSize"
                type="number"
                min={10}
                max={24}
                value={formData.editor.fontSize}
                onChange={e => handleChange('editor', 'fontSize', parseInt(e.target.value))}
                className="w-24"
              />
            </div>
            <div>
              <Label htmlFor="fontFamily">عائلة الخط</Label>
              <Input
                id="fontFamily"
                value={formData.editor.fontFamily}
                onChange={e => handleChange('editor', 'fontFamily', e.target.value)}
                placeholder="JetBrains Mono, Fira Code, Consolas, monospace"
              />
            </div>
          </div>
          <Separator />
          <div>
            <Label htmlFor="tabSize">حجم التبويب (مسافات)</Label>
            <Select
              value={formData.editor.tabSize.toString()}
              onValueChange={v => handleChange('editor', 'tabSize', parseInt(v))}
            >
              <SelectTrigger id="tabSize" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2">2 مسافات</SelectItem>
                <SelectItem value="4">4 مسافات</SelectItem>
                <SelectItem value="8">8 مسافات</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سلوك المحرر</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>التفاف الأسطر</Label>
              <Select
                value={formData.editor.wordWrap}
                onValueChange={v => handleChange('editor', 'wordWrap', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">مفعّل</SelectItem>
                  <SelectItem value="off">معطّل</SelectItem>
                  <SelectItem value="wordWrapColumn">عند العمود</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>أرقام الأسطر</Label>
              <Select
                value={formData.editor.lineNumbers}
                onValueChange={v => handleChange('editor', 'lineNumbers', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on">إظهار</SelectItem>
                  <SelectItem value="off">إخفاء</SelectItem>
                  <SelectItem value="relative">نسبية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>مطابقة الأقواس</Label>
              </div>
              <Switch
                checked={formData.editor.bracketMatching}
                onCheckedChange={v => handleChange('editor', 'bracketMatching', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>إغلاق الأقواس تلقائياً</Label>
              </div>
              <Switch
                checked={formData.editor.autoClosingBrackets}
                onCheckedChange={v => handleChange('editor', 'autoClosingBrackets', v)}
              />
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>تنسيق عند الحفظ</Label>
              </div>
              <Switch
                checked={formData.editor.formatOnSave}
                onCheckedChange={v => handleChange('editor', 'formatOnSave', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>تنسيق عند اللصق</Label>
              </div>
              <Switch
                checked={formData.editor.formatOnPaste}
                onCheckedChange={v => handleChange('editor', 'formatOnPaste', v)}
              />
            </div>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>الخريطة المصغرة</Label>
            </div>
            <Switch
              checked={formData.editor.minimap}
              onCheckedChange={v => handleChange('editor', 'minimap', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAI = () => (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>موفر الذكاء الاصطناعي</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="provider">الموفر</Label>
            <Select
              value={formData.ai.provider}
              onValueChange={v => handleChange('ai', 'provider', v as any)}
            >
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="local">محلي (Ollama/LM Studio)</SelectItem>
                <SelectItem value="custom">مخصص</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div>
            <Label htmlFor="apiKey">مفتاح API</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.ai.apiKey}
              onChange={e => handleChange('ai', 'apiKey', e.target.value)}
              placeholder="sk-..."
              dir="ltr"
              autoComplete="off"
            />
          </div>
          <div>
            <Label htmlFor="baseUrl">عنوان API الأساسي</Label>
            <Input
              id="baseUrl"
              value={formData.ai.baseUrl}
              onChange={e => handleChange('ai', 'baseUrl', e.target.value)}
              placeholder="https://api.openai.com/v1"
              dir="ltr"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات النموذج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="model">النموذج</Label>
            <Input
              id="model"
              value={formData.ai.model}
              onChange={e => handleChange('ai', 'model', e.target.value)}
              placeholder="gpt-4o, claude-3-opus, llama3"
              dir="ltr"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="temperature">درجة الحرارة ({formData.ai.temperature})</Label>
              <input
                id="temperature"
                type="range"
                min={0}
                max={2}
                step={0.1}
                value={formData.ai.temperature}
                onChange={e => handleChange('ai', 'temperature', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <Label htmlFor="maxTokens">أقصى عدد رموز ({formData.ai.maxTokens})</Label>
              <input
                id="maxTokens"
                type="range"
                min={512}
                max={8192}
                step={512}
                value={formData.ai.maxTokens}
                onChange={e => handleChange('ai', 'maxTokens', parseInt(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <Separator />
          <div>
            <Label htmlFor="systemPrompt">تعليمات النظام</Label>
            <textarea
              id="systemPrompt"
              value={formData.ai.systemPrompt}
              onChange={e => handleChange('ai', 'systemPrompt', e.target.value)}
              rows={4}
              className="w-full p-3 border border-input bg-background rounded-md text-sm font-mono resize-y"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الميزات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>الإكمال المضمن</Label>
              <p className="text-sm text-muted-foreground">اقتراحات الكود أثناء الكتابة</p>
            </div>
            <Switch
              checked={formData.ai.enableInlineCompletion}
              onCheckedChange={v => handleChange('ai', 'enableInlineCompletion', v)}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>محادثة الذكاء الاصطناعي</Label>
              <p className="text-sm text-muted-foreground">لوحة المحادثة الجانبية</p>
            </div>
            <Switch
              checked={formData.ai.enableChat}
              onCheckedChange={v => handleChange('ai', 'enableChat', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAppearance = () => (
    <div className="space-y-6" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle>السمة والألوان</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="theme">السمة</Label>
            <Select
              value={formData.appearance.theme}
              onValueChange={v => handleChange('appearance', 'theme', v as any)}
            >
              <SelectTrigger id="theme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">فاتح</SelectItem>
                <SelectItem value="dark">داكن</SelectItem>
                <SelectItem value="system">النظام</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="accentColor">لون التمييز</Label>
            <Input
              id="accentColor"
              type="color"
              value={formData.appearance.accentColor}
              onChange={e => handleChange('appearance', 'accentColor', e.target.value)}
              className="w-16 h-10 cursor-pointer"
            />
          </div>
          <div>
            <Label htmlFor="density">الكثافة</Label>
            <Select
              value={formData.appearance.density}
              onValueChange={v => handleChange('appearance', 'density', v as any)}
            >
              <SelectTrigger id="density">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comfortable">مريحة</SelectItem>
                <SelectItem value="compact">مدمجة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>اللغة والاتجاه</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="language">اللغة</Label>
            <Select
              value={formData.appearance.language}
              onValueChange={v => handleChange('appearance', 'language', v as any)}
            >
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>اتجاه RTL</Label>
              <p className="text-sm text-muted-foreground">عكس الواجهة للغات RTL</p>
            </div>
            <Switch
              checked={formData.appearance.rtl}
              onCheckedChange={v => handleChange('appearance', 'rtl', v)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAdvanced = () => (
    <div className="space-y-6" dir="rtl">
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">خيارات متقدمة</CardTitle>
          <CardDescription>تغيير هذه الإعدادات قد يؤثر على استقرار التطبيق</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>وضع التصحيح</Label>
              <p className="text-sm text-muted-foreground">تمكين سجلات مفصلة وأدوات المطور</p>
            </div>
            <Switch
              checked={formData.advanced.debugMode}
              onCheckedChange={v => handleChange('advanced', 'debugMode', v)}
            />
          </div>
          <Separator />
          <div>
            <Label htmlFor="logLevel">مستوى السجلات</Label>
            <Select
              value={formData.advanced.logLevel}
              onValueChange={v => handleChange('advanced', 'logLevel', v as any)}
            >
              <SelectTrigger id="logLevel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="error">خطأ فقط</SelectItem>
                <SelectItem value="warn">تحذيرات وأخطاء</SelectItem>
                <SelectItem value="info">معلومات</SelectItem>
                <SelectItem value="debug">تصحيح مفصل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <Label>الميزات التجريبية</Label>
              <p className="text-sm text-muted-foreground">تمكين ميزات قيد التطوير</p>
            </div>
            <Switch
              checked={formData.advanced.experimentalFeatures}
              onCheckedChange={v => handleChange('advanced', 'experimentalFeatures', v)}
            />
          </div>
          <Separator />
          <div>
            <Label htmlFor="customCss">CSS مخصص</Label>
            <textarea
              id="customCss"
              value={formData.advanced.customCss}
              onChange={e => handleChange('advanced', 'customCss', e.target.value)}
              rows={6}
              placeholder="/* CSS مخصص للتطبيق */"
              className="w-full p-3 border border-input bg-background rounded-md text-sm font-mono resize-y"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إجراءات خطيرة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={isLoading}
            className="w-full"
          >
            <AlertCircle className="mr-2 h-4 w-4" />
            إعادة تعيين هذا القسم
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneral();
      case 'editor': return renderEditor();
      case 'ai': return renderAI();
      case 'appearance': return renderAppearance();
      case 'advanced': return renderAdvanced();
    }
  };

  return (
    <div className="flex h-full flex-col" dir="rtl">
      <div className="flex items-center justify-between border-b p-4">
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-yellow-500 flex items-center gap-1">
              <span className="animate-pulse">●</span> تغييرات غير محفوظة
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={isLoading || !hasChanges}
            className={cn('gap-2', saveStatus === 'saving' && 'opacity-50')}
          >
            {saveStatus === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
            {saveStatus === 'success' && <CheckCircle className="h-4 w-4 text-green-500" />}
            {saveStatus === 'idle' && <Save className="h-4 w-4" />}
            حفظ
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
        <TabsList className="grid w-full grid-cols-5 border-b p-1" role="tablist">
          {tabs.map(tab => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center justify-center gap-1 px-3 py-2 text-sm"
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="general" className="flex-1 overflow-auto p-4">
          {renderGeneral()}
        </TabsContent>
        <TabsContent value="editor" className="flex-1 overflow-auto p-4">
          {renderEditor()}
        </TabsContent>
        <TabsContent value="ai" className="flex-1 overflow-auto p-4">
          {renderAI()}
        </TabsContent>
        <TabsContent value="appearance" className="flex-1 overflow-auto p-4">
          {renderAppearance()}
        </TabsContent>
        <TabsContent value="advanced" className="flex-1 overflow-auto p-4">
          {renderAdvanced()}
        </TabsContent>
      </Tabs>

      {error && (
        <div className="border border-destructive bg-destructive/10 text-destructive p-4 mx-4 mb-4 rounded-lg flex items-center gap-2" role="alert">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}