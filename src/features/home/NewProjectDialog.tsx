import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { nanoid } from 'nanoid';
import { ArrowRight, Code2, Smartphone, Globe, Terminal } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useStore } from '@app/store';
import type { Project } from '@app/types';

export function NewProjectDialog() {
  const navigate = useNavigate();
  const addProject = useStore(s => s.addProject);
  const [name,setName] = useState('');
  const [description,setDescription] = useState('');
  const [type,setType] = useState<Project['type']>('website');
  const [busy,setBusy] = useState(false);
  const create = () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    const now = Date.now();
    const project: Project = { id:nanoid(), name:name.trim(), description:description.trim(), type, primaryLanguage:'typescript', languages:['typescript'], files:[], createdAt:now, updatedAt:now };
    addProject(project);
    navigate(`/workspace/${project.id}`);
  };
  const choices = [{id:'website',label:'موقع ويب',Icon:Globe},{id:'apk',label:'تطبيق أندرويد',Icon:Smartphone},{id:'cli',label:'أداة سطر أوامر',Icon:Terminal},{id:'library',label:'مكتبة برمجية',Icon:Code2}] as const;
  return <section className="mx-auto max-w-2xl space-y-6">
    <button onClick={()=>navigate('/')} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowRight size={16}/> رجوع للمشاريع</button>
    <div><h1 className="text-2xl font-bold">إنشاء مشروع جديد</h1><p className="mt-2 text-sm text-muted-foreground">أنشئ مساحة عمل واحفظ ملفات مشروعك على هذا الجهاز.</p></div>
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
      <label className="block space-y-2 text-sm"><span>اسم المشروع</span><input value={name} onChange={e=>setName(e.target.value)} className="input-field" placeholder="مثال: تطبيق إدارة المهام" maxLength={80}/></label>
      <label className="block space-y-2 text-sm"><span>وصف المشروع</span><textarea value={description} onChange={e=>setDescription(e.target.value)} className="textarea-field" placeholder="اكتب وصفًا مختصرًا..." rows={3}/></label>
      <div className="space-y-2"><p className="text-sm">نوع المشروع</p><div className="grid grid-cols-2 gap-2">{choices.map(({id,label,Icon})=><button key={id} onClick={()=>setType(id)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${type===id?'border-primary bg-primary/10 text-primary':'border-border hover:bg-accent'}`}><Icon size={18}/>{label}</button>)}</div></div>
      <Button className="w-full" disabled={!name.trim()||busy} onClick={create}>إنشاء المشروع وفتحه</Button>
    </div>
  </section>;
}
