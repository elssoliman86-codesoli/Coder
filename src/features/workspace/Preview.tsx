import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Project } from '../../types';
import { buildPreviewHtml, runJsInWorker } from '../../lib/preview';
import { buildReactPreviewHtml } from '../../lib/react-preview';
import { detectKind, type KindInfo } from '../../lib/preview-kind';
import { runPython, runRemote, type Job } from '../../lib/runners';
import { app } from '../../storage/store';
import { mergeIssues, type ObservedIssue } from '../../agents/observer';
import { Icon, ProgressRing } from '../../components/ui';

export interface AuditSnapshot {
  issues: ObservedIssue[];
  bodyText: string;
}

export interface PreviewHandle {
  /** Remounts the preview with the latest files and resolves with the first audit. */
  reload(): Promise<AuditSnapshot>;
  issues(): ObservedIssue[];
  /** Starts (or restarts) the observation window. */
  observe(seconds: number): void;
}

interface Props {
  project: Project;
  onClose: () => void;
  /** Called when an observation window ends. */
  onWindowEnd: (s: AuditSnapshot) => void;
  disabled?: boolean;
  full?: boolean;
  onToggleFull?: () => void;
}

export const Preview = forwardRef<PreviewHandle, Props>(function Preview(props, ref) {
  const { project } = props;
  const info = useMemo(() => detectKind(project.files, project.type, project.primaryLanguage), [project.files, project.type, project.primaryLanguage]);
  if (info.kind === 'html' || info.kind === 'react' || info.kind === 'next') return <WebPreview ref={ref} {...props} info={info} />;
  if (info.kind === 'python' || info.kind === 'node' || info.kind === 'remote') return <TerminalPreview project={project} info={info} onClose={props.onClose} full={props.full} onToggleFull={props.onToggleFull} />;
  return <NoticePreview info={info} onClose={props.onClose} full={props.full} onToggleFull={props.onToggleFull} />;
});

function FullButton({ full, onToggle }: { full?: boolean; onToggle?: () => void }) {
  if (!onToggle) return null;
  return <button className="icon-btn" aria-label={full ? 'exit fullscreen' : 'fullscreen'} aria-pressed={!!full} onClick={onToggle} data-testid="fullscreen-btn"><Icon name={full ? 'shrink' : 'expand'} size={16} /></button>;
}

function NoticePreview({ info, onClose, full, onToggleFull }: { info: KindInfo; onClose: () => void; full?: boolean; onToggleFull?: () => void }) {
  return (
    <div className="preview" data-testid="preview">
      <div className="preview-bar"><strong>Preview</strong><span className="badge">{info.label}</span><span className="spacer" /><FullButton full={full} onToggle={onToggleFull} /><button className="icon-btn" aria-label="close preview" onClick={onClose}><Icon name="close" size={18} /></button></div>
      <div className="preview-stage"><p className="muted center" style={{ maxWidth: 520, padding: 16 }} data-testid="preview-note">{info.note}</p></div>
    </div>
  );
}

const WebPreview = forwardRef<PreviewHandle & object, Props & { info: KindInfo }>(function WebPreview({ project, onClose, onWindowEnd, disabled, info, full, onToggleFull }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [nonce, setNonce] = useState(0);
  const [device, setDevice] = useState<'phone' | 'tablet' | 'desktop'>(project.type === 'apk' ? 'phone' : 'desktop');
  const [issues, setIssues] = useState<ObservedIssue[]>([]);
  const issuesRef = useRef<ObservedIssue[]>([]);
  const bodyRef = useRef('');
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);
  const endsAt = useRef(0);
  const waiter = useRef<((s: AuditSnapshot) => void) | null>(null);
  const filesRef = useRef(project.files);
  filesRef.current = project.files;

  const slow = info.kind !== 'html';
  const built = useMemo(() => (info.kind === 'html' ? buildPreviewHtml(project.files, { observer: true }) : buildReactPreviewHtml(project.files, info.kind as 'react' | 'next', { observer: true })), [project.files, nonce, info.kind]);
  useEffect(() => () => built.revoke(), [built]);

  // Receive audit messages from the sandboxed iframe.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || !e.data?.__obs) return;
      if (e.data.kind === 'audit') {
        const next = mergeIssues(issuesRef.current, e.data.payload.issues as ObservedIssue[]);
        issuesRef.current = next;
        bodyRef.current = e.data.payload.bodyText ?? '';
        setIssues(next);
        if (waiter.current) { waiter.current({ issues: next, bodyText: bodyRef.current }); waiter.current = null; }
      }
    };
    window.addEventListener('message', h);
    return () => window.removeEventListener('message', h);
  }, []);

  // Observation window: re-audit every 5 seconds, then report.
  useEffect(() => {
    if (remaining <= 0 || disabled) return;
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left > 0 && left % 5 === 0) frame.current?.contentWindow?.postMessage({ __obs: 'run' }, '*');
      if (left === 0) {
        clearInterval(tick);
        onWindowEnd({ issues: issuesRef.current, bodyText: bodyRef.current });
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [remaining > 0, disabled, onWindowEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const observe = useCallback((seconds: number) => {
    endsAt.current = Date.now() + seconds * 1000;
    setTotal(seconds);
    setRemaining(seconds);
  }, []);

  useImperativeHandle(ref, () => ({
    reload: () =>
      new Promise<AuditSnapshot>((resolve) => {
        issuesRef.current = [];
        setIssues([]);
        const t = setTimeout(() => { waiter.current = null; resolve({ issues: issuesRef.current, bodyText: bodyRef.current }); }, slow ? 60_000 : 20_000);
        waiter.current = (s) => { clearTimeout(t); resolve(s); };
        setNonce((n) => n + 1);
      }),
    issues: () => issuesRef.current,
    observe,
  }), [observe]);

  const sizes = { phone: { w: 390, h: 780 }, tablet: { w: 768, h: 900 }, desktop: { w: 0, h: 0 } };
  const sz = sizes[device];

  return (
    <div className="preview" data-testid="preview">
      <div className="preview-bar">
        <strong>Preview</strong>
        <span className="badge" title={info.note}>{info.label}</span>
        <div className="seg" role="group" aria-label="device">
          {(['phone', 'tablet', 'desktop'] as const).map((d) => <button key={d} className={device === d ? 'seg-b on' : 'seg-b'} onClick={() => setDevice(d)}>{d}</button>)}
        </div>
        <button className="icon-btn" aria-label="reload" onClick={() => { issuesRef.current = []; setIssues([]); setNonce((n) => n + 1); }}><Icon name="refresh" size={16} /></button>
        <span className="spacer" />
        <FullButton full={full} onToggle={onToggleFull} />
        {remaining > 0 && <span className="observing" data-testid="observing"><ProgressRing value={total ? remaining / total : 0} size={30} label={String(remaining)} /> بيراقب…</span>}
        <span className={issues.length ? 'badge badge-warn' : 'badge badge-ok'} data-testid="issue-count">{issues.length} ملاحظة</span>
        <button className="icon-btn" aria-label="close preview" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <div className="preview-stage">
        {built.entry ? (
          <div className={device === 'phone' ? 'phone-frame' : ''} style={sz.w ? { width: sz.w, maxWidth: '100%', height: sz.h, maxHeight: '100%' } : { width: '100%', height: '100%' }}>
            {/* Sandboxed: scripts run, but with an opaque origin — no access to the app's storage or tokens. */}
            <iframe key={nonce} ref={frame} title="preview" sandbox="allow-scripts allow-forms allow-modals" srcDoc={built.html} className="preview-frame" data-testid="preview-frame" />
          </div>
        ) : <p className="muted center">مفيش ملف HTML للمعاينة</p>}
      </div>
    </div>
  );
});

function TerminalPreview({ project, info, onClose, full, onToggleFull }: { project: Project; info: KindInfo; onClose: () => void; full?: boolean; onToggleFull?: () => void }) {
  const files = project.files;
  const entries = files.filter((f) => (info.kind === 'python' ? /\.py$/.test(f.path) : info.kind === 'node' ? /\.(js|mjs|cjs)$/.test(f.path) : true));
  const main = entries.find((f) => /(^|\/)(main|index|cli|app|__main__)\.[a-z]+$/.test(f.path)) ?? entries.find((f) => /if __name__ == ['"]__main__['"]/.test(f.content)) ?? entries[0];
  const [out, setOut] = useState<{ t: string; k: 'out' | 'err' }[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const sentOk = useRef(false);
  useEffect(() => () => stopRef.current?.(), []);

  function run() {
    if (!main) return;
    setOut([]);
    const emit = (t: string, k: 'out' | 'err') => setOut((o) => [...o, { t, k }]);
    let job: Job;
    if (info.kind === 'python') job = runPython(files, main.path, emit);
    else if (info.kind === 'node') job = runJsInWorker(files, main.path, emit);
    else {
      const url = app.get().settings.runnerUrl;
      if (!sentOk.current && !window.confirm(`الكود هيتبعت لخدمة تشغيل خارجية (${url ? new URL(url).host : 'غير محددة'}) عشان يتنفذ. تكمّل؟`)) return;
      sentOk.current = true;
      job = runRemote(url, files, info.remoteLang!, emit);
    }
    stopRef.current = job.stop;
    setRunning(true);
    void job.done.then(() => setRunning(false));
  }

  return (
    <div className="preview" data-testid="preview">
      <div className="preview-bar">
        <strong>Terminal</strong>
        <span className="badge" title={info.note}>{info.label}</span>
        <span className="badge mono" dir="ltr">{main?.path ?? '—'}</span>
        <span className="spacer" />
        <FullButton full={full} onToggle={onToggleFull} />
        {running ? <button className="btn sm danger" onClick={() => stopRef.current?.()}>إيقاف</button> : <button className="btn sm primary" onClick={run} disabled={!main} data-testid="run-cli"><Icon name="play" size={14} /> تشغيل</button>}
        <button className="icon-btn" aria-label="close preview" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      {info.note && <p className="muted small preview-note">{info.note}</p>}
      <pre className="terminal mono" dir="ltr" data-testid="terminal">{out.length ? out.map((l, i) => <div key={i} className={l.k === 'err' ? 'term-err' : ''}>{l.t}</div>) : <span className="muted">$ اضغط «تشغيل»</span>}</pre>
    </div>
  );
}
