import { useRef, useState } from 'react';
import { Field, Icon, Modal, Spinner, toast } from '../../components/ui';
import { useT } from '../../i18n';
import { importFileList } from '../../lib/zip';
import { detectProjectType, primaryLanguage } from '../../lib/lang';
import { errMsg, uid } from '../../lib/util';
import { setState } from '../../storage/store';
import { startProject } from '../../runtime';
import { GithubImportModal } from './GithubImport';
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
  const [ghOpen, setGhOpen] = useState(false);
  const [progress, setProgress] = useState('');
  const [importErr, setImportErr] = useState('');
  const [aiBuild, setAiBuild] = useState(false);

  async function addFiles(picked: File[]) {
    if (!picked.length) return;
    setBusy(true);
    setImportErr('');
    setProgress('بيقرأ الملف…');
    try {
      // Read the bytes NOW: on Android the picked File can become unreadable once the input is reset.
      const list = await Promise.all(picked.map(async (f) => new File([await f.arrayBuffer()], f.name)));
      setProgress('بيفك الضغط…');
      const r = await importFileList(list, (d, t) => setProgress(`بيفك الضغط… ${d}/${t}`));
      if (r.files.length === 0) throw new Error(`الملف اتفتح بس مفيهوش ملفات نصية قابلة للتعديل${r.skipped.length ? ` (اتخطّى ${r.skipped.length} ملف: صور/ثنائية/node_modules)` : ''}`);
      setFiles((prev) => {
        const map = new Map(prev.map((f) => [f.path, f]));
        for (const f of r.files) map.set(f.path, f);
        return [...map.values()];
      });
      setSkipped((n) => n + r.skipped.length);
      setSource(list.map((f) => f.name).join(', '));
      if (!name) setName(list[0].name.replace(/\.[^.]+$/, '').replace(/-main$/, ''));
      toast(`تم فك الضغط: ${r.files.length} ملف${r.skipped.length ? ` (اتخطّى ${r.skipped.length})` : ''}`, 'ok');
    } catch (e) {
      setImportErr(errMsg(e));
      toast(errMsg(e), 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  function create() {
    const err: typeof errors = {};
    if (!name.trim()) err.name = 'اكتب اسم المشروع';
    if (!files.length && desc.trim().length < 10) err.desc = 'اكتب وصف فيه تفاصيل كفاية (10 حروف على الأقل)';
    setErrors(err);
    if (Object.keys(err).length) return;
    const id = uid('p');
    const paths = files.map((f) => f.path);
    const now = Date.now();
    const project: Project = {
      id, name: name.trim(), description: desc.trim() || `مشروع مستورد من ${source}`, type: paths.length ? detectProjectType(paths, files) : 'website',
      primaryLanguage: paths.length ? primaryLanguage(paths) : 'html', files, status: files.length && !aiBuild ? 'ready' : 'new', style: 'Minimalism', queue: [],
      importedFrom: source || undefined, createdAt: now, updatedAt: now, reviewCycles: 0,
    };
    setState((s) => { s.projects = { ...s.projects, [id]: project }; });
    onCreated(id);
    if (!files.length || aiBuild) void startProject(id);
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
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn" onClick={() => setGhOpen(true)} data-testid="gh-import"><Icon name="github" size={16} /> استدعاء من GitHub</button>
        <span className="muted small">افتح مشروع موجود على حسابك وعدّل عليه جزء جزء.</span>
      </div>
      {ghOpen && <GithubImportModal onClose={() => setGhOpen(false)} onImported={(id) => { setGhOpen(false); onCreated(id); }} />}
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
          <span>{busy ? <><Spinner /> {progress}</> : files.length ? `${files.length} ملف جاهز${skipped ? ` (تم تخطي ${skipped})` : ''} — ${source}` : t('importHint')}</span>
          <input ref={input} type="file" multiple hidden data-testid="import-input" onChange={(e) => { const picked = [...(e.target.files ?? [])]; void addFiles(picked).finally(() => { if (input.current) input.current.value = ''; }); }} />
        </div>
        {importErr && <p className="field-error" role="alert" data-testid="import-error">{importErr}</p>}
        {files.length > 0 && (
          <details className="stack" data-testid="import-files">
            <summary>الملفات اللي اتفك ضغطها ({files.length})</summary>
            <ul className="plan-files" dir="ltr">{files.slice(0, 300).map((f) => <li key={f.path} className="mono small">{f.path}</li>)}{files.length > 300 && <li className="muted small">… و{files.length - 300} ملف تاني</li>}</ul>
          </details>
        )}
        {files.length > 0 && (
          <label className="check"><input type="checkbox" checked={aiBuild} onChange={(e) => setAiBuild(e.target.checked)} data-testid="ai-build" /> خلّي الـ AI يخطط ويكمّل المشروع بناءً على الوصف (بيستخدم الموديل). من غير ده بيفتح الملفات بس وتعدّل براحتك.</label>
        )}
        {files.length > 0 && <button className="link" onClick={() => { setFiles([]); setSkipped(0); setSource(''); }}>{t('fromScratch')}</button>}
      </div>
    </Modal>
  );
}
