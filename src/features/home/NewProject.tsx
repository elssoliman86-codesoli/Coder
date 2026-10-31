import { useRef, useState } from 'react';
import { Field, Icon, Modal, toast } from '../../components/ui';
import { useT } from '../../i18n';
import { importFileList } from '../../lib/zip';
import { detectProjectType, primaryLanguage } from '../../lib/lang';
import { errMsg, uid } from '../../lib/util';
import { setState } from '../../storage/store';
import { startProject } from '../../runtime';
import type { Project, ProjectFile } from '../../types';

export function NewProjectDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const t = useT();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; desc?: string }>({});
  const input = useRef<HTMLInputElement>(null);

  async function addFiles(list: File[]) {
    if (!list.length) return;
    setBusy(true);
    try {
      const r = await importFileList(list);
      setFiles((prev) => {
        const map = new Map(prev.map((f) => [f.path, f]));
        for (const f of r.files) map.set(f.path, f);
        return [...map.values()];
      });
      setSkipped((n) => n + r.skipped.length);
      setSource(list.map((f) => f.name).join(', '));
      if (!name) setName(list[0].name.replace(/\.[^.]+$/, '').replace(/-main$/, ''));
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
    }
  }

  function create() {
    const err: typeof errors = {};
    if (!name.trim()) err.name = 'اكتب اسم المشروع';
    if (desc.trim().length < 10) err.desc = 'اكتب وصف فيه تفاصيل كفاية (10 حروف على الأقل)';
    setErrors(err);
    if (Object.keys(err).length) return;
    const id = uid('p');
    const paths = files.map((f) => f.path);
    const now = Date.now();
    const project: Project = {
      id, name: name.trim(), description: desc.trim(), type: paths.length ? detectProjectType(paths) : 'website',
      primaryLanguage: paths.length ? primaryLanguage(paths) : 'html', files, status: 'new', style: 'Minimalism', queue: [],
      importedFrom: source || undefined, createdAt: now, updatedAt: now, reviewCycles: 0,
    };
    setState((s) => { s.projects = { ...s.projects, [id]: project }; });
    onCreated(id);
    void startProject(id);
  }

  return (
    <Modal
      title={t('addProject')}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('cancel')}</button>
          <button className="btn primary" onClick={create} disabled={busy} data-testid="create-project">{t('create')}</button>
        </>
      }
    >
      <Field label={t('name')} error={errors.name}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} data-testid="project-name" autoFocus />
      </Field>
      <Field label={t('description')} hint={t('descHint')} error={errors.desc}>
        <textarea className="input textarea" rows={7} value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="project-desc" />
      </Field>
      <div className="field">
        <span className="field-label">{t('importOpt')}</span>
        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void addFiles([...e.dataTransfer.files]); }}
          onClick={() => input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') input.current?.click(); }}
        >
          <Icon name="upload" size={24} />
          <span>{files.length ? `${files.length} ملف جاهز${skipped ? ` (تم تخطي ${skipped})` : ''} — ${source}` : t('importHint')}</span>
          <input ref={input} type="file" multiple hidden data-testid="import-input" onChange={(e) => { void addFiles([...(e.target.files ?? [])]); e.target.value = ''; }} />
        </div>
        {files.length > 0 && <button className="link" onClick={() => { setFiles([]); setSkipped(0); setSource(''); }}>{t('fromScratch')}</button>}
      </div>
    </Modal>
  );
}
