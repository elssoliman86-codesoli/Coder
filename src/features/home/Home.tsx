import { useState } from 'react';
import { deleteProject } from '../../storage/store';
import { exportZip } from '../../lib/zip';
import { useApp } from '../../storage/store';
import { useT } from '../../i18n';
import { EmptyState, Icon, LangIcon } from '../../components/ui';
import { langMeta } from '../../lib/lang';
import type { Project } from '../../types';
import { NewProjectDialog } from './NewProject';

const TYPE_LABEL: Record<string, string> = { website: 'Website', webapp: 'Web app', backend: 'Backend', apk: 'APK', cli: 'CLI', exe: 'EXE', library: 'Library' };

function ProjectCard({ p, onOpen }: { p: Project; onOpen: () => void }) {
  async function downloadProject(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const blob = await exportZip(p.files);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${p.name.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'project'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر تنزيل المشروع'); }
  }
  function removeProject(e: React.MouseEvent) {
    e.stopPropagation();
    if (!window.confirm(`حذف المشروع «${p.name}» من هذا الجهاز؟ لا يمكن التراجع عن الحذف. نزّل نسخة ZIP أولًا لو محتاج تحتفظ به.`)) return;
    deleteProject(p.id);
  }
  const t = useT();
  const lang = langMeta(p.primaryLanguage);
  const files = p.files.length || p.plan?.files.length || 0;
  return (
    <div className="project-card-wrap">
    <button className="card project-card" onClick={onOpen} data-ui="card" data-testid="project-card">
      <div className="card-body">
        <h3 className="card-title">{p.name}</h3>
        <p className="card-meta">{lang.label}</p>
        <p className="card-meta">{files} {t('files')}</p>
        <div className="card-badges">
          <span className="badge">{TYPE_LABEL[p.type] ?? p.type}</span>
          {p.status !== 'ready' && <span className={`badge badge-${p.status}`}>{p.status === 'planning' ? 'بيخطط' : p.status === 'coding' ? 'بيكتب' : p.status === 'error' ? 'خطأ' : 'جديد'}</span>}
          {p.publish && <span className="badge badge-ok">{p.publish.version}</span>}
        </div>
      </div>
      <LangIcon lang={p.primaryLanguage} size={44} />
    </button>
    <div className="project-card-actions">
      <button className="btn sm" onClick={downloadProject} disabled={!p.files.length} aria-label="تنزيل ملفات المشروع" title="تنزيل ملفات المشروع ZIP"><Icon name="download" size={15} /> تنزيل ZIP</button>
      <button className="btn sm danger" onClick={removeProject} aria-label="حذف المشروع" title="حذف المشروع"><Icon name="trash-2" size={15} /> حذف</button>
    </div>
    </div>
  );
}

export function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const t = useT();
  const projects = useApp((s) => s.projects);
  const [dialog, setDialog] = useState(false);
  const list = Object.values(projects).sort((a, b) => b.updatedAt - a.updatedAt);
  return (
    <>
      <div className="page-head">
        <h1>{t('projects')}</h1>
        <div className="head-actions">
          <button className="icon-btn primary" aria-label={t('addProject')} onClick={() => setDialog(true)} data-testid="add-plus"><Icon name="plus" /></button>
          <button className="btn primary" onClick={() => setDialog(true)} data-testid="new-project">{t('addProject')}</button>
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState title={t('emptyTitle')} text={t('emptyText')} action={<button className="btn primary" onClick={() => setDialog(true)}>{t('newProject')}</button>} />
      ) : (
        <div className="grid">
          {list.map((p) => <ProjectCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />)}
        </div>
      )}
      {dialog && <NewProjectDialog onClose={() => setDialog(false)} onCreated={(id) => { setDialog(false); onOpen(id); }} />}
    </>
  );
}
