import { useState } from 'react';
import { nanoid } from 'nanoid';
import { del } from 'idb-keyval';
import { KeyRound, Plus, RefreshCw, Server, Trash2, Cpu } from 'lucide-react';
import { useSettings, useStore, useProviders } from '@app/store';
import { Button } from '@components/ui/button';
import type { Model, Provider } from '@app/types';

const presets = [
  { id: 'openai', label: 'OpenAI-compatible', baseUrl: 'https://api.openai.com/v1' },
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434' },
  { id: 'nvidia', label: 'NVIDIA NIM', baseUrl: 'https://integrate.api.nvidia.com/v1' },
  { id: 'custom', label: 'Custom endpoint', baseUrl: '' }
];

export function Settings() {
  const settings = useSettings();
  const providers = useProviders();
  const updateSettings = useStore(s => s.updateSettings);
  const addProvider = useStore(s => s.addProvider);
  const updateProvider = useStore(s => s.updateProvider);
  const deleteProvider = useStore(s => s.deleteProvider);
  const setModels = useStore(s => s.setModels);
  const [providerType, setProviderType] = useState('openai');
  const [providerName, setProviderName] = useState('OpenAI Compatible');
  const [baseUrl, setBaseUrl] = useState(presets[0].baseUrl);
  const [apiKey, setApiKey] = useState('');
  const [modelName, setModelName] = useState('');
  const [apiKeyDrafts, setApiKeyDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const choosePreset = (value: string) => {
    setProviderType(value);
    const preset = presets.find(p => p.id === value);
    if (preset) { setProviderName(preset.label); setBaseUrl(preset.baseUrl); }
  };

  const add = () => {
    if (!providerName.trim() || !baseUrl.trim()) { setNotice('اكتب اسم المزود ورابط API أولاً.'); return; }
    const provider: Provider = { id: nanoid(), name: providerName.trim(), provider: providerType, baseUrl: baseUrl.trim().replace(/\/+$/, ''), apiKey, models: [], default: providers.length === 0, createdAt: Date.now() };
    addProvider(provider);
    setApiKey('');
    setNotice('تمت إضافة المزود. أضف موديل أو اسحب قائمة الموديلات من الخادم.');
  };

  const discoverModels = async (provider: Provider) => {
    setBusyId(provider.id);
    setNotice('');
    try {
      const root = provider.baseUrl.trim().replace(/\/+$/, '');
      if (!root) throw new Error('أدخل Base URL صحيحاً للمزود.');

      const isOllama = provider.provider === 'ollama' || /:11434(?:$|\/)/i.test(root);
      const endpoints = isOllama
        ? [root + '/api/tags']
        : root.endsWith('/v1')
          ? [root + '/models', root.slice(0, -3) + '/v1/models']
          : [root + '/v1/models', root + '/models'];
      const key = (apiKeyDrafts[provider.id] ?? provider.apiKey ?? '').trim();
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (key) headers.Authorization = 'Bearer ' + key;

      let data: any = null;
      let lastError = '';
      for (const endpoint of [...new Set(endpoints)]) {
        try {
          const response = await fetch(endpoint, { method: 'GET', headers, cache: 'no-store' });
          if (!response.ok) {
            lastError = 'HTTP ' + response.status + ' من ' + endpoint;
            if (response.status === 401 || response.status === 403) {
              throw new Error('مفتاح API غير صحيح أو لا يملك صلاحية قراءة الموديلات (HTTP ' + response.status + ').');
            }
            continue;
          }
          data = await response.json();
          break;
        } catch (error) {
          if (error instanceof Error && (error.message.startsWith('مفتاح API') || error.message.startsWith('Failed to fetch'))) throw error;
          lastError = error instanceof Error ? error.message : 'تعذر الاتصال بالخادم';
        }
      }

      if (!data) {
        if (/Failed to fetch|NetworkError|fetch/i.test(lastError)) {
          throw new Error('تعذر الوصول إلى الخادم. تحقق من الإنترنت والرابط، وقد يكون السبب CORS. إذا كنت تستخدم Ollama فعّل السماح لأصل التطبيق عبر OLLAMA_ORIGINS، وعلى Android استخدم عنوان IP الخاص بالكمبيوتر بدلاً من localhost.');
        }
        throw new Error(lastError || 'لم يستجب الخادم على مسارات جلب الموديلات المعتادة.');
      }

      const rows = isOllama
        ? (Array.isArray(data.models) ? data.models : []).map((model: any) => ({ id: model.name, name: model.name, context_length: model.details?.parameter_size }))
        : (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : []);
      if (rows.length === 0) throw new Error('اتصلنا بالخادم لكن لم يرجع أي موديلات.');

      const existing = provider.models ?? [];
      const byId = new Map<string, Model>(existing.map(model => [model.id, model] as const));
      for (const row of rows) {
        const id = String(row.id ?? row.name ?? '').trim();
        if (!id) continue;
        const previous = byId.get(id);
        byId.set(id, previous ?? {
          id,
          name: String(row.name ?? row.id),
          providerId: provider.id,
          contextWindow: typeof row.context_length === 'number' ? row.context_length : undefined,
          status: 'untested',
          starred: false,
          assignedRoles: []
        });
      }
      const discovered = [...byId.values()];
      setModels(provider.id, discovered);
      setNotice('تم جلب ' + rows.length + ' موديل واحتفظنا بالموديلات التي أضفتها يدوياً. إجمالي القائمة: ' + discovered.length + '.');
    } catch (error) {
      setNotice('تعذر جلب الموديلات: ' + (error instanceof Error ? error.message : 'خطأ غير معروف'));
    } finally {
      setBusyId(null);
    }
  };

  const setDefaultProvider = (providerId: string) => {
    providers.forEach(provider => updateProvider(provider.id, { default: provider.id === providerId }));
  };

  const addManualModel = (provider: Provider) => {
    if (!modelName.trim()) return;
    const model: Model = { id: modelName.trim(), name: modelName.trim(), providerId: provider.id, status: 'untested', starred: false, assignedRoles: [] };
    setModels(provider.id, [...(provider.models ?? []), model]);
    setModelName('');
    setNotice('تمت إضافة الموديل إلى القائمة.');
  };

  return <section className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="text-2xl font-bold">الإعدادات</h1><p className="mt-2 text-sm text-muted-foreground">إعدادات التطبيق ومزودي الذكاء الاصطناعي والموديلات.</p></div>
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">إعدادات عامة</h2>
      <label className="flex items-center justify-between gap-4"><span>لغة الواجهة</span><select className="input-field max-w-40" value={settings.language} onChange={e=>updateSettings({language:e.target.value as 'ar'|'en'})}><option value="ar">العربية</option><option value="en">English</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>المظهر</span><select className="input-field max-w-40" value={settings.theme} onChange={e=>updateSettings({theme:e.target.value as 'dark'|'light'|'system'})}><option value="dark">داكن</option><option value="light">فاتح</option><option value="system">النظام</option></select></label>
      <label className="flex items-center justify-between gap-4"><span>حفظ تلقائي</span><input type="checkbox" checked={settings.autoSave} onChange={e=>updateSettings({autoSave:e.target.checked})}/></label>
    </div>

    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Server size={21}/></div><div><h2 className="font-semibold">مزودو الذكاء الاصطناعي</h2><p className="text-sm text-muted-foreground">اربط OpenAI أو NVIDIA أو Ollama أو أي API متوافق مع OpenAI.</p></div></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm"><span>نوع المزود</span><select className="input-field" value={providerType} onChange={e=>choosePreset(e.target.value)}>{presets.map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        <label className="space-y-1 text-sm"><span>اسم المزود</span><input className="input-field" value={providerName} onChange={e=>setProviderName(e.target.value)} placeholder="اسم المزود"/></label>
        <label className="space-y-1 text-sm md:col-span-2"><span>Base URL</span><input className="input-field" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" dir="ltr"/></label>
        <label className="space-y-1 text-sm md:col-span-2"><span className="flex items-center gap-2"><KeyRound size={14}/> API Key (اختياري لـ Ollama)</span><input className="input-field" type="password" autoComplete="off" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="أدخل مفتاح API" dir="ltr"/></label>
      </div>
      <Button onClick={add}><Plus size={16}/> إضافة المزود</Button>
      <p className="text-xs text-muted-foreground">لأمانك، مفتاح API لا يُحفظ داخل التخزين الدائم في هذه النسخة؛ ستحتاج لإدخاله مجدداً بعد إعادة تشغيل التطبيق.</p>
      {notice && <p role="status" className="rounded-lg border border-border bg-background p-3 text-sm">{notice}</p>}
      {providers.length === 0 ? <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground"><Server className="mx-auto mb-2" size={24}/>لم تتم إضافة أي مزود بعد.</div> :
        <div className="space-y-4">{providers.map(provider=><div key={provider.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 font-semibold"><Server size={16}/>{provider.name}{provider.default && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">افتراضي</span>}</div><p className="mt-1 break-all text-xs text-muted-foreground" dir="ltr">{provider.baseUrl}</p></div><div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={()=>setDefaultProvider(provider.id)} disabled={provider.default}>{provider.default ? 'المزود الافتراضي' : 'جعله افتراضياً'}</Button><Button variant="ghost" size="icon" onClick={()=>deleteProvider(provider.id)} aria-label="حذف المزود"><Trash2 size={16}/></Button></div></div>
          <label className="block space-y-1 text-xs"><span className="flex items-center gap-1"><KeyRound size={13}/> مفتاح API لهذا المزود (يُحفظ مؤقتاً في الجلسة)</span><input className="input-field" type="password" autoComplete="off" value={apiKeyDrafts[provider.id] ?? provider.apiKey ?? ''} onChange={e=>{setApiKeyDrafts(current=>({...current,[provider.id]:e.target.value}));updateProvider(provider.id,{apiKey:e.target.value});}} placeholder="أعد إدخال المفتاح بعد إعادة التشغيل" dir="ltr"/></label>
          <div className="flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" disabled={busyId===provider.id} onClick={()=>discoverModels(provider)}><RefreshCw size={14} className={busyId===provider.id?'animate-spin':''}/> {busyId===provider.id?'جارٍ التحميل':'جلب الموديلات'}</Button><span className="text-xs text-muted-foreground">{provider.models?.length ?? 0} موديل</span></div>
          <div className="flex flex-col gap-2 sm:flex-row"><input className="input-field" value={modelName} onChange={e=>setModelName(e.target.value)} placeholder="اسم موديل لإضافته يدوياً" dir="ltr"/><Button variant="secondary" onClick={()=>addManualModel(provider)} disabled={!modelName.trim()}><Plus size={15}/> إضافة موديل</Button></div>
          {(provider.models ?? []).length > 0 && <div className="divide-y divide-border rounded-lg border border-border">{provider.models.map(model=><div key={model.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm"><div className="min-w-0"><p className="truncate font-medium" dir="ltr">{model.name}</p><p className="text-xs text-muted-foreground">{model.status==='ok'?'متاح':model.status==='error'?'به خطأ':'لم يتم اختباره'}</p></div><Cpu size={16} className="shrink-0 text-muted-foreground"/></div>)}</div>}
        </div>)}</div>
      }
    </div>
    <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold">البيانات المحلية</h2><p className="my-2 text-sm text-muted-foreground">إعادة الضبط تحذف المشاريع والمزودين والإعدادات المحفوظة على هذا الجهاز.</p><Button variant="outline" onClick={async()=>{if(window.confirm('هل تريد حذف كل بيانات التطبيق المحلية؟ لا يمكن التراجع.')){await del('2onebyte-coder-storage');localStorage.removeItem('2onebyte-coder-storage');sessionStorage.removeItem('2onebyte-new-project-draft');window.location.reload();}}}>إعادة ضبط بيانات التطبيق</Button></div>
  </section>;
}
