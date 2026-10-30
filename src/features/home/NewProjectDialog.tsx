import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowRight, Code2, Smartphone, Globe, Terminal } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useStore, useProviders } from '@app/store';
import type { Project, ProjectFile } from '@app/types';
import { resolveActiveModel, generateProjectFiles } from '@lib/ai/client';

const DRAFT_KEY = '2onebyte-new-project-draft';
type Draft = { name: string; description: string; type: Project['type'] };
const defaultDraft: Draft = { name: '', description: '', type: 'website' };

function readDraft(): Draft {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return defaultDraft;
    const parsed = JSON.parse(raw) as Partial<Draft>;
    const validTypes: Project['type'][] = ['website', 'apk', 'cli', 'exe', 'library'];
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      type: validTypes.includes(parsed.type as Project['type']) ? parsed.type as Project['type'] : 'website'
    };
  } catch { return defaultDraft; }
}

export function NewProjectDialog() {
  const navigate = useNavigate();
  const providers = useProviders();
  const addProject = useStore(s => s.addProject);
  const setCurrentProject = useStore(s => s.setCurrentProject);
  const updateProject = useStore(s => s.updateProject);
  const [draft, setDraft] = useState<Draft>(readDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* Draft remains in component state. */ }
  }, [draft]);

  const updateDraft = (updates: Partial<Draft>) => {
    setDraft(current => ({ ...current, ...updates }));
    setError('');
  };

  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.name.trim() || busy) return;
    setBusy(true);
    setError('');

    const now = Date.now();
    const id = nanoid();
    const readme = '# ' + draft.name.trim() + '\n\n' + (draft.description.trim() || 'ابدأ العمل على مشروعك هنا.') + '\n';
    const initialFile: ProjectFile = {
      path: 'README.md', content: readme, language: 'markdown',
      size: new Blob([readme]).size, modified: false, lastModified: now
    };
    const active = resolveActiveModel();
    const project: Project = {
      id, name: draft.name.trim(), description: draft.description.trim(), type: draft.type,
      primaryLanguage: 'typescript', languages: ['typescript'], files: [initialFile],
      createdAt: now, updatedAt: now, generationStatus: active ? 'running' : 'idle'
    };

    try {
      addProject(project);
      setCurrentProject(id);
      try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* Ignore unavailable session storage. */ }
      navigate('/workspace/' + encodeURIComponent(id));

      if (active) {
        void generateProjectFiles(project, active.provider, active.model).then(result => {
          updateProject(id, { files: result.files, generationStatus: 'complete', generationSummary: result.summary, generationError: undefined, updatedAt: Date.now() });
        }).catch(cause => {
          updateProject(id, {
            generationStatus: 'error',
            generationError: cause instanceof Error ? cause.message : 'تعذر توليد الملفات.',
            updatedAt: Date.now()
          });
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المشروع. حاول مرة أخرى.');
      setBusy(false);
    }
  };

  const choices = [
    { id: 'website', label: 'موقع ويب', Icon: Globe },
    { id: 'apk', label: 'تطبيق أندرويد', Icon: Smartphone },
    { id: 'cli', label: 'أداة سطر أوامر', Icon: Terminal },
    { id: 'exe', label: 'برنامج سطح مكتب', Icon: Code2 },
    { id: 'library', label: 'مكتبة برمجية', Icon: Code2 }
  ] as const;

  return <section className="mx-auto max-w-2xl space-y-6">
    <button type="button" onClick={() => navigate('/')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowRight size={16}/> رجوع للمشاريع</button>
    <div><h1 className="text-2xl font-bold">إنشاء مشروع جديد</h1><p className="mt-2 text-sm text-muted-foreground">أنشئ مساحة عمل محلية، وسيبدأ الموديل المختار تحليل الوصف وتوليد ملفات المشروع تلقائيًا.</p></div>
    <form onSubmit={create} className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <label className="block space-y-2 text-sm"><span>اسم المشروع</span><input autoComplete="off" required value={draft.name} onChange={event => updateDraft({ name: event.target.value })} className="input-field" placeholder="مثال: تطبيق إدارة المهام" maxLength={80}/></label>
      <label className="block space-y-2 text-sm"><span>وصف المشروع</span><textarea value={draft.description} onChange={event => updateDraft({ description: event.target.value })} className="textarea-field" placeholder="اكتب الوظائف المطلوبة بالتفصيل..." rows={4}/></label>
      <fieldset className="space-y-2"><legend className="text-sm">نوع المشروع</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{choices.map(({ id: type, label, Icon }) => <button type="button" key={type} aria-pressed={draft.type === type} onClick={() => updateDraft({ type })} className={`flex min-h-12 items-center gap-2 rounded-xl border p-3 text-sm transition-colors ${draft.type === type ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-accent'}`}><Icon size={18}/>{label}</button>)}</div></fieldset>
      {!providers.length && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600">لم تضف مزود ذكاء اصطناعي بعد. سيتم إنشاء مساحة عمل محلية فقط؛ أضف مزودًا وموديلًا من الإعدادات لتفعيل التوليد.</p>}
      {providers.length > 0 && !resolveActiveModel() && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600">المزود موجود لكن لا يوجد موديل محدد. اختر موديلًا من الإعدادات قبل إنشاء مشروع مولّد.</p>}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={!draft.name.trim() || busy} loading={busy}>إنشاء المشروع وبدء التحليل</Button>
    </form>
  </section>;
}
