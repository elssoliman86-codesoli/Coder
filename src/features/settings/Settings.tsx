import { useState } from 'react';
import { nanoid } from 'nanoid';
import { del } from 'idb-keyval';
import { KeyRound, Plus, RefreshCw, Server, Trash2, Wifi, CheckCircle2 } from 'lucide-react';
import { useSettings, useStore, useProviders } from '@app/store';
import { Button } from '@components/ui/button';
import type { Model, Provider } from '@app/types';
import { discoverProviderModels, testProviderConnection } from '@lib/ai/client';
import { clearProviderSecrets, removeProviderSecret, saveProviderSecret } from '@lib/ai/secrets';

const presets = [
  { id: 'openai', label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434' },
  { id: 'nvidia', label: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1' },
  { id: 'custom', label: 'Custom endpoint', baseUrl: '' }
];

export function Settings() {
  const settings = useSettings();
  const providers = useProviders();
  const updateSettings = useStore(state => state.updateSettings);
  const addProvider = useStore(state => state.addProvider);
  const updateProvider = useStore(state => state.updateProvider);
  const deleteProvider = useStore(state => state.deleteProvider);
  const setModels = useStore(state => state.setModels);
  const [providerType, setProviderType] = useState('openai');
  const [providerName, setProviderName] = useState('OpenAI Compatible');
  const [baseUrl, setBaseUrl] = useState(presets[0].baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [manualModel, setManualModel] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const choosePreset = (value: string) => {
    setProviderType(value);
    const preset = presets.find(item => item.id === value);
    if (preset) { setProviderName(preset.label); setBaseUrl(preset.baseUrl); }
  };

  const add = async () => {
    if (!providerName.trim() || !baseUrl.trim()) { setError('اكتب اسم المزود ورابط API أولاً.'); return; }
    const provider: Provider = {
      id: nanoid(), name: providerName.trim(), provider: providerType,
      baseUrl: baseUrl.trim().replace(/\/+$/, ''), apiKey: apiKey.trim(),
      models: [], default: providers.length === 0, createdAt: Date.now()
    };
    try {
      await saveProviderSecret(provider.id, provider.apiKey);
      addProvider(provider);
      setApiKey('');
      setNotice('تمت إضافة المزود وحفظ المفتاح محليًا. جارٍ جلب الموديلات تلقائيًا...');
      setError('');
      if (provider.apiKey || provider.provider === 'ollama') void discoverModels(provider);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ المفتاح محليًا.');
    }
  };

  const discoverModels = async (provider: Provider) => {
    setBusyId(provider.id); setNotice('جارٍ الاتصال بالمزود وجلب قائمة الموديلات...'); setError('');
    try {
      const models = await discoverProviderModels(provider);
      setModels(provider.id, models);
      const selectedModelId = provider.selectedModelId && models.some(model => model.id === provider.selectedModelId)
        ? provider.selectedModelId : models[0]?.id;
      updateProvider(provider.id, { selectedModelId });
      setNotice('تم الاتصال وجلب ' + models.length + ' موديل. اختر الموديل الذي تريد استخدامه.');
    } catch (cause) {
      setError('تعذر جلب الموديلات: ' + (cause instanceof Error ? cause.message : 'خطأ غير معروف'));
      setNotice('');
    } finally { setBusyId(null); }
  };

  const selectModel = (providerId: string, modelId: string) => {
    updateProvider(providerId, { selectedModelId: modelId });
    setNotice('تم حفظ الموديل المختار.');
  };

  const testConnection = async (provider: Provider) => {
    const model = provider.models?.find(item => item.id === provider.selectedModelId) ?? provider.models?.[0];
    if (!model) { setError('اسحب قائمة الموديلات واختر موديلًا أولاً.'); return; }
    setTestingId(provider.id); setError(''); setNotice('جارٍ اختبار طلب محادثة حقيقي مع ' + model.name + '...');
    updateProvider(provider.id, { models: provider.models.map(item => item.id === model.id ? { ...item, status: 'testing' } : item) });
    try {
      await testProviderConnection(provider, model);
      updateProvider(provider.id, { models: provider.models.map(item => item.id === model.id ? { ...item, status: 'ok', lastTested: Date.now(), statusError: undefined } : item) });
      setNotice('اتصال ناجح: الموديل ' + model.name + ' رد على طلب الاختبار.');
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'فشل اختبار الاتصال.';
      updateProvider(provider.id, { models: provider.models.map(item => item.id === model.id ? { ...item, status: 'error', statusError: message, lastTested: Date.now() } : item) });
      setError('فشل الاتصال بالموديل: ' + message); setNotice('');
    } finally { setTestingId(null); }
  };

  const setDefaultProvider = (providerId: string) => {
    providers.forEach(provider => updateProvider(provider.id, { default: provider.id === providerId }));
    setNotice('تم تعيين المزود الافتراضي.');
  };

  const addManualModel = (provider: Provider) => {
    const id = manualModel.trim();
    if (!id) return;
    const next: Model = { id, name: id, providerId: provider.id, status: 'untested', starred: false, assignedRoles: [] };
    const models = [...(provider.models ?? []).filter(item => item.id !== id), next];
    setModels(provider.id, models);
    if (!provider.selectedModelId) updateProvider(provider.id, { selectedModelId: id });
    setManualModel('');
  };

  const removeProvider = async (providerId: string) => {
    await removeProviderSecret(providerId);
    deleteProvider(providerId);
  };

  return <section className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">الإعدادات</h1><p className="mt-2 text-sm text-muted-foreground">إعدادات التطبيق ومزودي الذكاء الاصطناعي والموديلات.</p></div>
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">إعدادات عامة</h2>
      <label className="flex items-center justify-between gap-4"><span>لغة الواجهة</span><select className="input-field max-w-40" value={settings.language} onChange={event => updateSettings({ language: event.target.value as 'ar' | 'en' })}><option value="ar">العربية</option><option value="en">English</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>المظهر</span><select className="input-field max-w-40" value={settings.theme} onChange={event => updateSettings({ theme: event.target.value as 'dark' | 'light' | 'system' })}><option value="dark">داكن</option><option value="light">فاتح</option><option value="system">النظام</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>حفظ تلقائي</span><input type="checkbox" checked={settings.autoSave} onChange={event => updateSettings({ autoSave: event.target.checked })}/></label>
    </div>

    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Server size={21}/></div><div><h2 className="font-semibold">مزودو الذكاء الاصطناعي</h2><p className="text-sm text-muted-foreground">OpenAI-compatible وNVIDIA NIM وOllama وأي endpoint متوافق مع OpenAI Chat Completions.</p></div></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span>نوع المزود</span><select className="input-field" value={providerType} onChange={event => choosePreset(event.target.value)}>{presets.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>اسم المزود</span><input className="input-field" value={providerName} onChange={event => setProviderName(event.target.value)} placeholder="اسم المزود"/></label>
        <label className="space-y-1 text-sm md:col-span-2"><span>Base URL</span><input className="input-field" value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" dir="ltr"/></label>
        <label className="space-y-1 text-sm md:col-span-2"><span className="flex items-center gap-2"><KeyRound size={14}/> API Key {providerType === 'ollama' ? '(اختياري)' : ''}</span><input className="input-field" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="أدخل مفتاح API" dir="ltr"/></label>
      </div>
      <Button onClick={() => void add()}><Plus size={16}/> إضافة المزود</Button>
      <p className="text-xs text-muted-foreground">المفتاح يُحفظ محليًا داخل IndexedDB على هذا الجهاز ولا يُرفع إلى خادم التطبيق. التخزين المحلي ليس خزنة مشفرة؛ احمِ جهازك ولا تشارك نسخة بيانات التطبيق.</p>
      {notice && <p role="status" className="rounded-lg border border-border bg-background p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {providers.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"><Server className="mx-auto mb-2" size={24}/>لم تتم إضافة أي مزود بعد.</div> :
        <div className="space-y-4">{providers.map(provider => <div key={provider.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><div className="flex items-center gap-2 font-semibold"><Server size={16}/>{provider.name}{provider.default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">افتراضي</span>}</div><p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">{provider.baseUrl}</p></div>
            <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => setDefaultProvider(provider.id)} disabled={provider.default}>{provider.default ? 'المزود الافتراضي' : 'جعله افتراضيًا'}</Button><Button variant="ghost" size="icon" onClick={() => void removeProvider(provider.id)} aria-label="حذف المزود"><Trash2 size={16}/></Button></div>
          </div>
          <label className="block space-y-1 text-xs"><span className="flex items-center gap-1"><KeyRound size={13}/> مفتاح API (يُحفظ محليًا)</span><input className="input-field" type="password" autoComplete="off" value={provider.apiKey ?? ''} onChange={event => { const value = event.target.value; updateProvider(provider.id, { apiKey: value }); void saveProviderSecret(provider.id, value).catch(cause => setError(cause instanceof Error ? cause.message : 'تعذر حفظ المفتاح محليًا.')); }} placeholder="مفتاح هذا المزود" dir="ltr"/></label>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <label className="space-y-1 text-xs"><span>الموديل النشط</span><select className="input-field" value={provider.selectedModelId ?? ''} onChange={event => selectModel(provider.id, event.target.value)} disabled={!provider.models?.length}><option value="">اختر موديلًا</option>{(provider.models ?? []).map(model => <option key={model.id} value={model.id}>{model.name}</option>)}</select></label>
            <Button className="self-end" variant="outline" size="sm" disabled={busyId === provider.id} onClick={() => void discoverModels(provider)}><RefreshCw size={14} className={busyId === provider.id ? 'animate-spin' : ''}/>{busyId === provider.id ? 'جاري الجلب' : 'جلب الموديلات'}</Button>
            <Button className="self-end" variant="secondary" size="sm" disabled={testingId === provider.id || !provider.models?.length} onClick={() => void testConnection(provider)}><Wifi size={14}/>{testingId === provider.id ? 'اختبار...' : 'اختبار الاتصال'}</Button>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{provider.models?.length ?? 0} موديل متاح</span>{provider.models?.find(model => model.id === provider.selectedModelId)?.status === 'ok' && <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 size={13}/> الاتصال ناجح</span>}</div>
          <details className="text-xs text-muted-foreground"><summary className="cursor-pointer">إضافة موديل يدويًا (للمزودات التي لا تعرض قائمة الموديلات)</summary><div className="mt-2 flex gap-2"><input className="input-field" value={manualModel} onChange={event => setManualModel(event.target.value)} placeholder="model-id" dir="ltr"/><Button variant="outline" size="sm" disabled={!manualModel.trim()} onClick={() => addManualModel(provider)}><Plus size={14}/> إضافة</Button></div></details>
        </div>)}</div>
      }
    </div>

    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">التخزين والخصوصية</h2>
      <p className="my-2 text-sm text-muted-foreground">المشاريع والملفات والإعدادات والموديلات والمفاتيح محفوظة محليًا على هذا الجهاز داخل IndexedDB. لا توجد قاعدة بيانات سحابية أو مزامنة تلقائية. عند استخدام AI، يُرسل نص الطلب والسياق والملفات اللازمة إلى API الخاص بالمزود.</p>
      <p className="mb-3 text-xs text-muted-foreground">المفاتيح ليست مشفرة في هذه النسخة. لا تستخدم جهازًا مشتركًا، ولا تشارك بيانات التطبيق المحلية.</p>
      <Button variant="outline" onClick={() => void (async () => {
        if (!window.confirm('هل تريد حذف كل بيانات التطبيق المحلية؟ لا يمكن التراجع.')) return;
        await clearProviderSecrets();
        await del('2onebyte-coder-storage');
        localStorage.removeItem('2onebyte-coder-storage');
        sessionStorage.removeItem('2onebyte-new-project-draft');
        window.location.reload();
      })()}>إعادة ضبط بيانات التطبيق</Button>
    </div>
  </section>;
}
