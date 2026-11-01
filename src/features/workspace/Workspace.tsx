import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp, setState, commitFile, acceptChanges } from '../../storage/store';
import { useT } from '../../i18n';
import { Icon, Modal, Spinner, toast, useEscape, useNarrow } from '../../components/ui';
import { errMsg } from '../../lib/util';
import { acceptRecovery, cancel, discardRecovery, resumeRecovery, startProject, useRuntime } from '../../runtime';
import { modelOptions } from '../settings/Settings';
import { Editor } from './Editor';
import { FileTree } from './FileTree';
import { Preview, type PreviewHandle } from './Preview';
import { PromptBar } from './PromptBar';
import { PublishModal, DetailsModal } from './Publish';
import { PlanModal } from './PlanView';
import { ReviewPopover, useReview } from './Review';
import { basename } from '../../lib/lang';
import { detectKind } from '../../lib/preview-kind';
import { diffStats } from '../../lib/diff';

export function Workspace({ id, onOpenSettings }: { id: string; onBack: () => void; onOpenSettings: () => void }) {
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
  const [planOpen, setPlanOpen] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [full, setFull] = useState(false);
  useEscape(() => setFull(false), full);
  const preview = useRef<PreviewHandle>(null);
  const kind = useMemo(() => (project ? detectKind(project.files, project.type, project.primaryLanguage).kind : 'none'), [project?.files, project?.type, project?.primaryLanguage]); // eslint-disable-line react-hooks/exhaustive-deps
  // The design-review loop only makes sense for previews of the real UI (not terminals, notices or AI simulations).
  const reviewable = kind === 'html' || kind === 'react' || kind === 'next';
  // +added/−removed per file, relative to the content before the AI's pending changes (Claude/Codex style).
  const stats = useMemo(() => {
    const out: Record<string, { added: number; removed: number }> = {};
    if (!project?.baseline) return out;
    const cur = new Map(project.files.map((f) => [f.path, f.content]));
    for (const [path, before] of Object.entries(project.baseline)) {
      const now = cur.get(path);
      if (now === undefined || now === before) continue;
      out[path] = diffStats(before ?? '', now);
    }
    return out;
  }, [project?.baseline, project?.files]);
  const review = useReview(id, preview);
  const stopAll = () => { review.stop(); cancel(id); };

  const opts = useMemo(() => modelOptions(providers), [providers]);
  const files = project?.files ?? [];
  const planned = project?.plan?.files.map((f) => f.path) ?? [];

  // Follow the file being written live.
  useEffect(() => {
    if (!following || following === 'PLAN.json') return;
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
    if (was && !busy && !review.wasStopped() && showPreview && reviewable && project?.status === 'ready' && review.phase !== 'fixing') {
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
    if (!reviewable) return;
    setTimeout(() => void review.fixLoop().catch((e) => toast(errMsg(e), 'error')), 50);
  };

  return (
    <div className="workspace" data-testid="workspace">
      <header className="ws-top" dir="ltr">
        <button className="icon-btn" ref={toggleBtn} aria-label="toggle sidebar" aria-controls="ws-sidebar" aria-expanded={sidebar} onClick={toggleSidebar} data-testid="sidebar-toggle"><Icon name="sidebar" /></button>
        <strong className="ws-title" dir="auto">{project.name}</strong>
        {(working || review.phase === 'fixing') && <Activity id={id} label={project.status === 'planning' || busy === 'plan' ? 'بيخطط' : busy === 'publish' ? 'بينشر' : busy === 'fix' || review.phase === 'fixing' ? 'بيصلح' : 'بيكتب'} onStop={stopAll} onThinking={() => setThinkingOpen(true)} />}
        <span className="spacer" />
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
            {(project.thinking || busy) && <button className="btn block" onClick={() => { closeSidebar(); setThinkingOpen(true); }} data-testid="thinking-side">تفكير الموديل</button>}
            <button className="btn block" onClick={() => { closeSidebar(); setPlanOpen(true); }} data-testid="plan-btn"><Icon name="list" size={16} /> الخطة{project.plan ? ` (${project.plan.files.length})` : ''}</button>
            <section className="card files-card" aria-label={t('filesCard')} data-ui="card">
              <h3 className="card-title">{t('filesCard')} <span className="badge">{files.length}</span></h3>
              <FileTree stats={stats} paths={files.map((f) => f.path)} planned={planned} active={active} live={following ? [following] : []} onSelect={openFile} />
            </section>
            <button className="btn primary block" onClick={() => { closeSidebar(); setPublishOpen(true); }} disabled={!files.length || working} data-testid="publish-btn"><Icon name="github" size={16} /> {t('publish')}</button>
            {project.publish && <button className="btn block" onClick={() => { closeSidebar(); setDetailsOpen(true); }} data-testid="details-btn">{t('details')}</button>}
            {project.status === 'error' && <button className="btn block" onClick={() => void startProject(id)}>إعادة المحاولة</button>}
          </aside>
        )}

        <main className="ws-main">
          {!busy && project.recovery && Object.keys(project.recovery).length > 0 && (
            <div className="recovery" role="alert" data-testid="recovery">
              <strong>الاتصال فصل أو العملية اتوقفت — الكود اللي وصل اتحفظ:</strong>
              {Object.entries(project.recovery).map(([path, text]) => (
                <div key={path} className="recovery-row">
                  <span className="mono" dir="ltr">{path}</span> <span className="muted small">{text.length} حرف</span>
                  <span className="spacer" />
                  <button className="btn sm primary" onClick={() => void resumeRecovery(id, path)} data-testid="recovery-resume">كمّل</button>
                  <button className="btn sm" onClick={() => { acceptRecovery(id, path); openFile(path); }}>احفظه كده</button>
                  <button className="btn sm" onClick={() => discardRecovery(id, path)}>تجاهل</button>
                </div>
              ))}
            </div>
          )}
          {showPreview && (
            <div className={full ? 'ws-preview full' : 'ws-preview'} data-testid="ws-preview">
              <Preview ref={preview} project={project} full={full} onToggleFull={() => setFull(!full)} onClose={() => { setShowPreview(false); setFull(false); }} onWindowEnd={() => review.onWindowEnd()} disabled={review.phase === 'fixing'} />
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
              <Editor path={active} content={current?.content ?? ''} draft={draft} onSave={(c) => { commitFile(id, active, c); acceptChanges(id, active); }} base={active && project.baseline && active in project.baseline && current && project.baseline[active] !== current.content ? project.baseline[active] : undefined} />
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
      {thinkingOpen && <ThinkingModal id={id} saved={project.thinking} onClose={() => setThinkingOpen(false)} />}
      {planOpen && <PlanModal project={project} onClose={() => setPlanOpen(false)} onOpenFile={openFile} />}
      {detailsOpen && <DetailsModal project={project} onClose={() => setDetailsOpen(false)} />}
    </div>
  );
}

const fmtElapsed = (ms: number) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/** Live proof of life while a job runs: stage, elapsed time, characters received and the tail of the model's output. */
function Activity({ id, label, onStop, onThinking }: { id: string; label: string; onStop: () => void; onThinking: () => void }) {
  const progress = useRuntime((r) => r.progress[id]);
  const stage = useRuntime((r) => r.logs[id]?.slice(-1)[0]?.msg ?? '');
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const quiet = progress ? Math.floor((now - progress.lastAt) / 1000) : 0;
  return (
    <span className="activity" data-testid="activity" role="status">
      <Spinner />
      <span className="activity-text">
        <b>{label}… {progress ? fmtElapsed(now - progress.startedAt) : ''}</b>
        <small className="muted" dir="auto">{progress && progress.chars > 0 ? `وصل ${progress.chars} حرف من الموديل${quiet >= 20 ? ` — ساكت من ${quiet} ث` : ' ✓ شغّال'}` : progress && progress.think > 0 ? `بيفكر… ${progress.think} حرف تفكير${quiet >= 20 ? ` — ساكت من ${quiet} ث` : ' ✓ شغّال'}` : quiet >= 20 ? `لسه مستني أول رد من الموديل (${quiet} ث)…` : stage}</small>
      </span>
      {progress && progress.think > 0 && <button className="btn sm" onClick={onThinking} data-testid="thinking-btn">التفكير</button>}
      <button className="btn danger sm" onClick={onStop} data-testid="stop-btn" aria-label="إيقاف"><Icon name="stop" size={14} /> إيقاف</button>
    </span>
  );
}

/** The model's reasoning text: live while a job runs, otherwise the copy saved from the last job. */
function ThinkingModal({ id, saved, onClose }: { id: string; saved?: string; onClose: () => void }) {
  const live = useRuntime((r) => r.thinking[id]);
  const text = live || saved || '';
  return (
    <Modal title="تفكير الموديل" onClose={onClose} wide>
      {text ? <pre className="log mono small" dir="auto" style={{ whiteSpace: 'pre-wrap', maxHeight: '65dvh', overflow: 'auto' }} data-testid="thinking-text">{text}</pre>
        : <p className="muted">الموديل ده ما بعتش نص تفكير (مش كل الموديلات بتبعته). لو بيفكر هتلاقيه هنا لايف ومحفوظ.</p>}
    </Modal>
  );
}
