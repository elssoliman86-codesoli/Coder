import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileCode2, Save, Plus, FolderOpen, Check, LoaderCircle, AlertCircle } from 'lucide-react';
import { useStore, useSettings } from '@app/store';
import { Button } from '@components/ui/button';
import { getLanguageFromPath } from '@lib/utils';
import { CodeEditor } from './CodeEditor';

export function Workspace() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const project = useStore(state => state.projects[projectId]);
  const updateProject = useStore(state => state.updateProject);
  const setCurrentProject = useStore(state => state.setCurrentProject);
  const settings = useSettings();
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');
  const [newPath, setNewPath] = useState('');
  const [dirty, setDirty] = useState(false);
  const files = useMemo(() => project?.files ?? [], [project?.files]);

  useEffect(() => {
    const current = useStore.getState().projects[projectId];
    if (!current) return;
    setCurrentProject(current.id);
    const first = current.files?.find(file => file.path !== 'README.md') ?? current.files?.[0];
    if (first) { setPath(first.path); setContent(first.content ?? ''); }
    else { setPath('README.md'); setContent('# ' + current.name + '\n\nابدأ كتابة ملفات مشروعك هنا.'); }
    setDirty(false);
  }, [projectId, setCurrentProject]);

  const save = () => {
    if (!project || !path) return;
    const current = useStore.getState().projects[project.id];
    if (!current) return;
    const nextFile = {
      path, content, language: getLanguageFromPath(path),
      size: new Blob([content]).size, modified: false, lastModified: Date.now()
    };
    const next = [...(current.files ?? []).filter(file => file.path !== path), nextFile]
      .sort((a, b) => a.path.localeCompare(b.path));
    updateProject(project.id, { files: next, updatedAt: Date.now() });
    setDirty(false);
  };

  useEffect(() => {
    if (!settings.autoSave || !dirty || !path || !project) return;
    const timeout = window.setTimeout(() => save(), 700);
    return () => window.clearTimeout(timeout);
  }, [content, dirty, path, project?.id, settings.autoSave]);

  useEffect(() => {
    if (!project || dirty || project.generationStatus !== 'complete') return;
    const firstSource = project.files.find(file => file.path !== 'README.md');
    if (firstSource && path === 'README.md') {
      setPath(firstSource.path);
      setContent(firstSource.content ?? '');
    }
  }, [project?.generationStatus, project?.files, dirty, path]);

  const openFile = (nextPath: string, nextContent: string) => {
    if (dirty) save();
    setPath(nextPath);
    setContent(nextContent);
    setDirty(false);
  };

  const createFile = () => {
    const clean = newPath.trim().replace(/\\/g, '/').replace(/^\/+/, '');
    if (!clean || clean.split('/').some(part => part === '..' || !part)) return;
    if (dirty) save();
    const current = useStore.getState().projects[projectId];
    if (!current) return;
    const existing = current.files ?? [];
    const match = existing.find(file => file.path === clean);
    if (match) {
      setPath(match.path);
      setContent(match.content ?? '');
      setDirty(false);
      setNewPath('');
      return;
    }
    const now = Date.now();
    const file = { path: clean, content: '', language: getLanguageFromPath(clean), size: 0, modified: false, lastModified: now };
    updateProject(projectId, { files: [...existing, file].sort((a, b) => a.path.localeCompare(b.path)), updatedAt: now });
    setPath(clean);
    setContent('');
    setDirty(false);
    setNewPath('');
  };

  if (!project) return <div className="space-y-4 rounded-2xl border border-border bg-card p-6"><p>المشروع غير موجود أو لم يتم تحميل بياناته.</p><Button onClick={() => navigate('/')}>العودة للمشاريع</Button></div>;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><button onClick={() => navigate('/')} className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight size={16}/> المشاريع</button><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-sm text-muted-foreground">{project.description || 'مساحة عمل المشروع'}</p></div>
      <div className="flex items-center gap-3">{dirty ? <span className="text-xs text-amber-500">تعديلات غير محفوظة</span> : <span className="flex items-center gap-1 text-xs text-emerald-500"><Check size={14}/> محفوظ</span>}<Button onClick={save}><Save size={16}/> حفظ الملف</Button></div>
    </div>

    {project.generationStatus === 'running' && <div role="status" className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm"><LoaderCircle className="animate-spin text-primary" size={18}/><div><p className="font-medium">الذكاء الاصطناعي بيحلل المشروع وبيجهز الملفات</p><p className="text-xs text-muted-foreground">قد يستغرق ذلك بعض الوقت حسب المزود والموديل.</p></div></div>}
    {project.generationStatus === 'error' && <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><AlertCircle className="mt-0.5 shrink-0 text-destructive" size={18}/><div><p className="font-medium">تعذر توليد ملفات المشروع</p><p className="mt-1 text-muted-foreground">{project.generationError || 'حدث خطأ غير معروف.'}</p></div></div>}
    {(!project.generationStatus || project.generationStatus === 'idle') && <div className="rounded-xl border border-dashed border-border p-3 text-xs text-muted-foreground">المشروع محفوظ محليًا. لبدء التوليد التلقائي، أضف مزودًا واختر موديلًا من الإعدادات ثم أنشئ مشروعًا جديدًا.</div>}

    <div className="grid min-h-[68vh] overflow-hidden rounded-2xl border border-border lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card p-3 lg:border-b-0 lg:border-l">
        <div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">ملفات المشروع</p><FolderOpen size={15}/></div>
        <div className="mb-3 flex gap-2"><input aria-label="مسار الملف الجديد" className="input-field min-w-0" value={newPath} onChange={event => setNewPath(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') createFile(); }} placeholder="src/index.ts"/><Button size="icon" onClick={createFile} disabled={!newPath.trim()} aria-label="إنشاء ملف"><Plus size={16}/></Button></div>
        <div className="max-h-[55vh] space-y-1 overflow-auto">{files.map(file => <button key={file.path} onClick={() => openFile(file.path, file.content ?? '')} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm ${path === file.path ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}><FileCode2 size={15}/><span className="truncate">{file.path}</span></button>)}</div>
        <p className="mt-4 text-xs text-muted-foreground">{files.length} ملف محفوظ</p>
      </aside>
      <div className="flex min-h-[55vh] flex-col bg-[#0b1120]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 font-mono text-xs text-slate-300" dir="ltr"><span>{path || 'اختر ملفًا'}</span><span>{getLanguageFromPath(path || '')}</span></div>
        <div className="min-h-[55vh] flex-1"><CodeEditor value={content} language={getLanguageFromPath(path || '')} onChange={value => { setContent(value); setDirty(true); }}/></div>
      </div>
    </div>
  </section>;
}
