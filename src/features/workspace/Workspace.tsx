import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileCode2, Save, Plus, FolderOpen } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useStore } from '@app/store';
import { Button } from '@components/ui/button';
import { getLanguageFromPath } from '@lib/utils';

export function Workspace() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const project = useStore(s => s.projects[projectId]);
  const updateProject = useStore(s => s.updateProject);
  const setCurrentProject = useStore(s => s.setCurrentProject);
  const [path, setPath] = useState('README.md');
  const [content, setContent] = useState('');
  const [newPath, setNewPath] = useState('');
  const files = useMemo(() => project?.files ?? [], [project?.files]);

  useEffect(() => {
    const current = useStore.getState().projects[projectId];
    if (!current) return;
    setCurrentProject(current.id);
    const first = current.files?.[0];
    if (first) { setPath(first.path); setContent(first.content ?? ''); }
    else { setPath('README.md'); setContent('# ' + current.name + '\n\nابدأ كتابة ملفات مشروعك هنا.'); }
  }, [projectId, setCurrentProject]);

  if (!project) return <div className="space-y-4 rounded-2xl border border-border bg-card p-6"><p>المشروع غير موجود أو لم يتم تحميل بياناته.</p><Button onClick={() => navigate('/')}>العودة للمشاريع</Button></div>;

  const save = () => {
    const next = [...files.filter(f => f.path !== path), { path, content, language: getLanguageFromPath(path), size: new Blob([content]).size, modified: false, lastModified: Date.now() }];
    updateProject(project.id, { files: next, updatedAt: Date.now() });
  };
  const createFile = () => {
    const clean = newPath.trim().replace(/^\/+/, '');
    if (!clean || clean.split('/').some(part => part === '..')) return;
    if (files.some(file => file.path === clean)) { setPath(clean); setContent(files.find(file => file.path === clean)?.content ?? ''); setNewPath(''); return; }
    setPath(clean); setContent(''); setNewPath('');
  };

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><button onClick={() => navigate('/')} className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight size={16}/> المشاريع</button><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-sm text-muted-foreground">{project.description || 'مساحة عمل المشروع'}</p></div><Button onClick={save}><Save size={16}/> حفظ الملف</Button></div>
    <div className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-border lg:grid-cols-[260px_1fr]">
      <aside className="border-b border-border bg-card p-3 lg:border-b-0 lg:border-l"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">ملفات المشروع</p><FolderOpen size={15}/></div>
        <div className="mb-3 flex gap-2"><input aria-label="مسار الملف الجديد" className="input-field min-w-0" value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="src/index.ts"/><Button size="icon" onClick={createFile} disabled={!newPath.trim()} aria-label="إنشاء ملف"><Plus size={16}/></Button></div>
        {files.map(file => <button key={file.path} onClick={() => { setPath(file.path); setContent(file.content ?? ''); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm ${path === file.path ? 'bg-primary/10 text-primary' : 'hover:bg-accent'}`}><FileCode2 size={15}/><span className="truncate">{file.path}</span></button>)}
        <p className="mt-4 text-xs text-muted-foreground">{files.length} ملف محفوظ</p>
      </aside>
      <div className="flex min-h-[55vh] flex-col bg-[#0b1120]"><div className="border-b border-white/10 px-4 py-3 font-mono text-xs text-slate-300" dir="ltr">{path}</div><textarea aria-label="محرر الملفات" value={content} onChange={e => setContent(e.target.value)} spellCheck={false} className="min-h-[55vh] flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-7 text-slate-100 outline-none" /></div>
    </div>
  </section>;
}
