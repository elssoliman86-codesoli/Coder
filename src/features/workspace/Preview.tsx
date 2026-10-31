import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Project } from '../../types';
import { buildPreviewHtml, runJsInWorker } from '../../lib/preview';
import { mergeIssues, type ObservedIssue } from '../../agents/observer';
import { Icon, ProgressRing } from '../../components/ui';
import { languageOf } from '../../lib/lang';

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
}

const WEB = new Set(['website', 'apk', 'exe']);

export const Preview = forwardRef<PreviewHandle, Props>(function Preview({ project, onClose, onWindowEnd, disabled }, ref) {
  const isWeb = WEB.has(project.type) && project.files.some((f) => f.path.endsWith('.html'));
  return isWeb
    ? <WebPreview ref={ref} project={project} onClose={onClose} onWindowEnd={onWindowEnd} disabled={disabled} />
    : <TerminalPreview project={project} onClose={onClose} />;
});

const WebPreview = forwardRef<PreviewHandle, Props>(function WebPreview({ project, onClose, onWindowEnd, disabled }, ref) {
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

  const built = useMemo(() => buildPreviewHtml(project.files, { observer: true }), [project.files, nonce]);
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
        const t = setTimeout(() => { waiter.current = null; resolve({ issues: issuesRef.current, bodyText: bodyRef.current }); }, 20_000);
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
        <span className="badge">{project.type === 'apk' ? 'Runtime (نسخة ويب للتطبيق)' : 'Website'}</span>
        <div className="seg" role="group" aria-label="device">
          {(['phone', 'tablet', 'desktop'] as const).map((d) => <button key={d} className={device === d ? 'seg-b on' : 'seg-b'} onClick={() => setDevice(d)}>{d}</button>)}
        </div>
        <button className="icon-btn" aria-label="reload" onClick={() => { issuesRef.current = []; setIssues([]); setNonce((n) => n + 1); }}><Icon name="refresh" size={16} /></button>
        <span className="spacer" />
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

function TerminalPreview({ project, onClose }: { project: Project; onClose: () => void }) {
  const entries = project.files.filter((f) => /\.(js|mjs|py|go|rs|sh)$/.test(f.path));
  const main = entries.find((f) => /(^|\/)(main|index|cli|app)\.(js|mjs|py)$/.test(f.path)) ?? entries[0];
  const [out, setOut] = useState<{ t: string; k: 'out' | 'err' }[]>([]);
  const [running, setRunning] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  const lang = main ? languageOf(main.path) : '';
  useEffect(() => () => stopRef.current?.(), []);

  function run() {
    if (!main) return;
    setOut([]);
    if (lang !== 'javascript') {
      setOut([{ t: `${main.path}: معاينة ${lang || 'هذه اللغة'} محتاجة runner بعيد (Pyodide/Docker) — مش متضمن في النسخة دي. شغّل الملف على جهازك أو بعد النشر.`, k: 'err' }]);
      return;
    }
    setRunning(true);
    const job = runJsInWorker(project.files, main.path, (t, k) => setOut((o) => [...o, { t, k }]));
    stopRef.current = job.stop;
    void job.done.then(() => setRunning(false));
  }

  return (
    <div className="preview" data-testid="preview">
      <div className="preview-bar">
        <strong>Terminal</strong>
        <span className="badge mono" dir="ltr">{main?.path ?? '—'}</span>
        <span className="spacer" />
        {running ? <button className="btn sm danger" onClick={() => stopRef.current?.()}>إيقاف</button> : <button className="btn sm primary" onClick={run} disabled={!main} data-testid="run-cli"><Icon name="play" size={14} /> تشغيل</button>}
        <button className="icon-btn" aria-label="close preview" onClick={onClose}><Icon name="close" size={18} /></button>
      </div>
      <pre className="terminal mono" dir="ltr" data-testid="terminal">{out.length ? out.map((l, i) => <div key={i} className={l.k === 'err' ? 'term-err' : ''}>{l.t}</div>) : <span className="muted">$ اضغط «تشغيل»</span>}</pre>
    </div>
  );
}
