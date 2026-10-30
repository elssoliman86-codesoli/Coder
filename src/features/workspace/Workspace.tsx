import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, FileCode2, Save } from 'lucide-react';
import { useStore } from '@app/store';
import { Button } from '@components/ui/button';

export function Workspace() {
  const {projectId=''} = useParams();
  const navigate = useNavigate();
  const project = useStore(s=>s.projects[projectId]);
  const updateProject = useStore(s=>s.updateProject);
  const [path,setPath] = useState('README.md');
  const [content,setContent] = useState('# '+(project?.name??'مشروعي')+'\n\nابدأ كتابة ملفات مشروعك هنا.');
  const files = useMemo(()=>project?.files??[],[project?.files]);
  if(!project) return <div className="space-y-4"><p>المشروع غير موجود.</p><Button onClick={()=>navigate('/')}>العودة للمشاريع</Button></div>;
  const save = () => {
    const next = [...project.files.filter(f=>f.path!==path),{path,content,language:path.endsWith('.md')?'markdown':'text',size:new Blob([content]).size,modified:false,lastModified:Date.now()}];
    updateProject(project.id,{files:next,updatedAt:Date.now()});
  };
  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><button onClick={()=>navigate('/')} className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ArrowRight size={16}/> المشاريع</button><h1 className="text-2xl font-bold">{project.name}</h1><p className="text-sm text-muted-foreground">{project.description||'مساحة عمل المشروع'}</p></div><Button onClick={save}><Save size={16}/> حفظ الملف</Button></div>
    <div className="grid min-h-[65vh] overflow-hidden rounded-2xl border border-border lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-border bg-card p-3 lg:border-b-0 lg:border-l"><p className="mb-3 text-xs font-semibold text-muted-foreground">ملفات المشروع</p>{files.map(f=><button key={f.path} onClick={()=>{setPath(f.path);setContent(f.content)}} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm ${path===f.path?'bg-primary/10 text-primary':'hover:bg-accent'}`}><FileCode2 size={15}/>{f.path}</button>)}<p className="mt-4 text-xs text-muted-foreground">{files.length} ملف محفوظ</p></aside>
      <div className="flex min-h-[55vh] flex-col bg-[#0b1120]"><div className="border-b border-white/10 px-4 py-3 font-mono text-xs text-slate-300">{path}</div><textarea aria-label="محرر الملفات" value={content} onChange={e=>setContent(e.target.value)} spellCheck={false} className="min-h-[55vh] flex-1 resize-none bg-transparent p-5 font-mono text-sm leading-7 text-slate-100 outline-none" /></div>
    </div>
  </section>;
}
