import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { Plus, FolderOpen, Code2, Smartphone, Globe, Terminal, Trash2 } from 'lucide-react';
import { Card } from '@components/ui/card';
import { Button } from '@components/ui/button';
import { useStore } from '@app/store';
import type { Project } from '@app/types';

const types: {id:Project['type'];label:string;Icon:typeof Globe}[] = [
  {id:'website',label:'موقع ويب',Icon:Globe},
  {id:'apk',label:'تطبيق أندرويد',Icon:Smartphone},
  {id:'cli',label:'أداة سطر أوامر',Icon:Terminal},
  {id:'library',label:'مكتبة برمجية',Icon:Code2}
];

export function Home() {
  const navigate = useNavigate();
  const projects = useStore(s=>s.projects);
  const addProject = useStore(s=>s.addProject);
  const deleteProject = useStore(s=>s.deleteProject);
  const createProject = () => {
    const now=Date.now();
    const project:Project={id:nanoid(),name:'مشروع جديد',description:'',type:'website',primaryLanguage:'typescript',languages:['typescript'],files:[],createdAt:now,updatedAt:now};
    addProject(project);
    navigate('/new-project');
  };
  const list=Object.values(projects).sort((a,b)=>b.updatedAt-a.updatedAt);
  return <section className="mx-auto max-w-7xl space-y-8">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-sm text-primary">مساحة التطوير الذكية</p><h1 className="text-3xl font-bold">مشاريعك</h1><p className="mt-2 text-sm text-muted-foreground">أنشئ مشاريعك ونظّم ملفاتك من مكان واحد.</p></div><Button onClick={createProject}><Plus size={18}/> مشروع جديد</Button></div>
    {list.length===0 ? <div className="flex min-h-[45vh] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center"><div className="mb-4 rounded-2xl bg-primary/10 p-4 text-primary"><FolderOpen size={34}/></div><h2 className="text-xl font-semibold">لسه مفيش مشاريع</h2><p className="my-3 max-w-sm text-sm text-muted-foreground">ابدأ بمشروع جديد، وبعدها هتقدر تضيف ملفاتك وتعدلها وتحفظها محليًا.</p><Button onClick={createProject}><Plus size={17}/> إنشاء أول مشروع</Button></div> :
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{list.map(project=>{const item=types.find(t=>t.id===project.type)??types[0];const Icon=item.Icon;return <Card key={project.id} variant="hover" className="group p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Icon size={22}/></div><button aria-label="حذف المشروع" onClick={()=>{if(window.confirm('حذف المشروع؟'))deleteProject(project.id)}} className="rounded-lg p-2 text-muted-foreground opacity-70 hover:bg-destructive/10 hover:text-destructive"><Trash2 size={17}/></button></div><button onClick={()=>navigate('/workspace/'+project.id)} className="mt-5 block w-full text-right"><h2 className="font-semibold">{project.name}</h2><p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted-foreground">{project.description||'لا يوجد وصف للمشروع'}</p></button><div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground"><span>{item.label}</span><span>{project.files.length} ملف</span></div></Card>})}</div>}
  </section>;
}
