import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, setState, commitFile } from '../../storage/store';
import { useT } from '../../i18n';
import { Icon, Spinner, toast, useEscape, useNarrow } from '../../components/ui';
import { errMsg } from '../../lib/util';
import { cancel, startProject, useRuntime } from '../../runtime';
import { modelOptions } from '../settings/Settings';
import { Editor } from './Editor';
import { FileTree } from './FileTree';
import { Preview, type PreviewHandle } from './Preview';
import { PromptBar } from './PromptBar';
import { PublishModal, DetailsModal } from './Publish';
import { ReviewPopover, useReview } from './Review';
import { basename } from '../../lib/lang';

export function Workspace({ id, onBack, onOpenSettings }: { id: string; onBack: () => void; onOpenSettings: () => void }) {
  const t = useT();
  const project = useApp((s) => s.projects[id]);
  const providers = useApp((s) => s.providers);
  const coder = useApp((s) => s.roles.coder);
  const drafts = useRuntime((r) => r.drafts[id]);
  const following = useRuntime((r) => r.following[id] ?? null);
  const busy = useRuntime((r) => r.busy[id] ?? null);
  const logs = useRuntime((r) => r.logs[id]);

  // Sidebar: inline panel on wide screens (state remembered), overlay drawer with scrim on phones (closed by default).
  const narrow = useNarrow();
  const [wide, setWide] = useState(() => { try { return localStorage.getItem('ws-sidebar') !== '0'; } catch { return true; } });
  const [sheet, setSheet] = useState(false);
  const sidebar = narrow ? sheet : wide;
  const toggleBtn = useRef<HTMLButtonElement>(null);
  const closeSidebar = () => { if (narrow) { setSheet(false); toggleBtn.current?.focus(); } };
  const toggleSidebar = () => {
    if (narrow) setSheet((v) => !v);
    else setWide((v) => { const n = !v; try { localStorage.setItem('ws-sidebar', n ? '1' : '0'); } catch { /* storage unavailable */ } return n; });
  };
  useEscape(closeSidebar, narrow && sheet);
  useEffect(() => { if (!narrow) setSheet(false); }, [narrow]);
  useEffect(() => {
    if (!(narrow && sheet)) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [narrow, sheet]);
  const [open, setOpen] = useState<string[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const preview = useRef<PreviewHandle>(null);
  const review = useReview(id, preview);

  const opts = useMemo(() => modelOptions(providers), [providers]);
  const files = project?.files ?? [];
  const planned = project?.plan?.files.map((f) => f.path) ?? [];

  // Follow the file being written live.
  useEffect(() => {
    if (!following) return;
    setActive(following);
    setOpen((o) => (o.includes(following) ? o : [...o, following]));
  }, [following]);

  // Open the first file once the project has some.
  useEffect(() => {
    if (!active && files.length) { setActive(files[0].path); setOpen([files[0].path]); }
  }, [files.length, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // When a job finishes while the preview is open, run the review loop again.
  const wasBusy = useRef(false);
  useEffect(() => {
    const was = wasBusy.current;
    wasBusy.current = !!busy;
    if (was && !busy && showPreview && project?.status === 'ready' && review.phase !== 'fixing') {
      setTimeout(() => void review.fixLoop().catch((e) => toast(errMsg(e), 'error')), 0);
    }
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return <p className="muted center">المشروع مش موجود</p>;

  const current = active ? files.find((f) => f.path === active) : undefined;
  const draft = active ? drafts?.[active] : undefined;
  const modelValue = coder ? `${coder.providerId}::${coder.modelId}` : '';
  const working = project.status === 'planning' || project.status === 'coding' || !!busy;
  const canPreview = project.files.length > 0;

  const openFile = (p: string) => { setActive(p); setOpen((o) => (o.includes(p) ? o : [...o, p])); closeSidebar(); };
  const closeTab = (p: string) => {
    setOpen((o) => o.filter((x) => x !== p));
    if (active === p) setActive(open.filter((x) => x !== p).slice(-1)[0] ?? null);
  };
  const togglePreview = () => {
    closeSidebar();
    if (showPreview) { setShowPreview(false); return; }
    setShowPreview(true);
    setTimeout(() => void review.fixLoop().catch((e) => toast(errMsg(e), 'error')), 50);
  };

  return (
    <div className="workspace" data-testid="workspace">
      <header className="ws-top" dir="ltr">
        <button className="icon-btn" ref={toggleBtn} aria-label="toggle sidebar" aria-controls="ws-sidebar" aria-expanded={sidebar} onClick={toggleSidebar} data-testid="sidebar-toggle"><Icon name="sidebar" /></button>
        <strong className="ws-title" dir="auto">{project.name}</strong>
        {working && <span className="activity" data-testid="activity"><Spinner /> {project.status === 'planning' ? 'بيخطط…' : busy === 'publish' ? 'بينشر…' : busy === 'fix' ? 'بيصلح…' : 'بيكتب…'}<button className="icon-btn" aria-label="stop" onClick={() => cancel(id)}><Icon name="stop" size={16} /></button></span>}
        <span className="spacer" />
        <button className="btn sm" onClick={onBack}>{t('projects')}</button>
      </header>

      <div className="ws-body">
        {narrow && sheet && <div className="side-scrim" onMouseDown={closeSidebar} data-testid="sidebar-scrim" />}
        {sidebar && (
          <aside id="ws-sidebar" className={narrow ? 'ws-side overlay' : 'ws-side'} aria-label="project sidebar" data-testid="sidebar">
            {narrow && <div className="row side-head"><strong dir="auto">{project.name}</strong><span className="spacer" /><button className="icon-btn" aria-label={t('close')} onClick={closeSidebar} data-testid="sidebar-close"><Icon name="close" /></button></div>}
            <label className="field">
              <span className="field-label">{t('codingModel')}</span>
              <select className="input mono" dir="ltr" value={modelValue} data-testid="coder-model"
                onChange={(e) => { const [providerId, ...r] = e.target.value.split('::'); setState((s) => { s.roles = { ...s.roles, coder: { providerId, modelId: r.join('::') } }; }); }}>
                {!modelValue && <option value="">{opts.length ? '— اختار —' : t('noModel')}</option>}
                {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <button className={showPreview ? 'btn on block' : 'btn block'} onClick={togglePreview} disabled={!canPreview || (working && !showPreview)} data-testid="preview-btn"><Icon name="play" size={16} /> {t('preview')}</button>
            <section className="card files-card" aria-label={t('filesCard')} data-ui="card">
              <h3 className="card-title">{t('filesCard')} <span className="badge">{files.length}</span></h3>
              <FileTree paths={files.map((f) => f.path)} planned={planned} active={active} live={following ? [following] : []} onSelect={openFile} />
            </section>
            <button className="btn primary block" onClick={() => { closeSidebar(); setPublishOpen(true); }} disabled={!files.length || working} data-testid="publish-btn"><Icon name="github" size={16} /> {t('publish')}</button>
            {project.publish && <button className="btn block" onClick={() => { closeSidebar(); setDetailsOpen(true); }} data-testid="details-btn">{t('details')}</button>}
            {project.status === 'error' && <button className="btn block" onClick={() => void startProject(id)}>إعادة المحاولة</button>}
          </aside>
        )}

        <main className="ws-main">
          {showPreview && (
            <div className="ws-preview">
              <Preview ref={preview} project={project} onClose={() => setShowPreview(false)} onWindowEnd={() => review.onWindowEnd()} disabled={review.phase === 'fixing'} />
              {review.note && <div className="review-note" role="status" data-testid="review-note"><Spinner /> {review.note}</div>}
              <ReviewPopover project={project} phase={review.phase} issues={preview.current?.issues().length ?? 0}
                onContinue={review.keepWatching} onAnother={review.anotherEdit} onDone={review.done}
                onCritique={(text) => void review.fixLoop(text).catch((e) => toast(errMsg(e), 'error'))} />
            </div>
          )}
          <div className={showPreview ? 'ws-editor split' : 'ws-editor'}>
            {open.length > 0 && (
              <div className="file-tabs" role="tablist">
                {open.map((p) => (
                  <span key={p} className={p === active ? 'ftab on' : 'ftab'} role="tab" aria-selected={p === active}>
                    <button onClick={() => setActive(p)} dir="ltr">{basename(p)}</button>
                    <button className="x" aria-label={`close ${p}`} onClick={() => closeTab(p)}><Icon name="close" size={12} /></button>
                  </span>
                ))}
              </div>
            )}
            {active && (current || draft !== undefined) ? (
              <Editor path={active} content={current?.content ?? ''} draft={draft} onSave={(c) => commitFile(id, active, c)} />
            ) : (
              <div className="center muted ws-empty">{working ? <><Spinner /> بيجهّز الملفات…</> : 'اختار ملف من القايمة'}</div>
            )}
          </div>
          {logs && logs.length > 0 && (
            <div className={`logline log-${logs[logs.length - 1].kind}`} role="status" data-testid="logline">{logs[logs.length - 1].msg}</div>
          )}
        </main>
      </div>

      <PromptBar project={project} disabled={project.status === 'planning' || project.status === 'coding'} />
      {publishOpen && <PublishModal project={project} onClose={() => setPublishOpen(false)} onOpenSettings={onOpenSettings} />}
      {detailsOpen && <DetailsModal project={project} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}
