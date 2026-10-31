import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { langMeta } from '../lib/lang';
import { createStore } from '../storage/store';

// ---------- icons (inline SVG, 24px grid) ----------
const PATHS: Record<string, string> = {
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  file: 'M7 3h7l5 5v13H7V3zM14 3v5h5',
  play: 'M7 5l12 7-12 7V5z',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  github: 'M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9c0 6-12 3-12 6',
  sidebar: 'M4 5h16v14H4V5zM9 5v14',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  check: 'M5 12l5 5 9-10',
  stop: 'M6 6h12v12H6z',
  upload: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z',
  refresh: 'M20 11a8 8 0 10-2.300 5.700M20 4v7h-7',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  copy: 'M8 8h12v12H8V8zM4 4h12v2H6v10H4V4z',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="icon">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}

/** Language icon: a coloured rounded square with the language glyph. */
export function LangIcon({ lang, size = 36 }: { lang: string; size?: number }) {
  const m = langMeta(lang);
  return (
    <span className="lang-icon" title={m.label} style={{ width: size, height: size, background: m.color + '22', color: m.color, borderColor: m.color + '55', fontSize: size * 0.38 }} dir="ltr">
      {m.glyph}
    </span>
  );
}

export function StatusDot({ status, label }: { status: 'ok' | 'error' | 'untested' | 'testing'; label?: string }) {
  return <span className={`dot dot-${status}`} role="img" aria-label={label ?? status} title={label ?? status} />;
}

export function ProgressRing({ value, size = 44, label }: { value: number; size?: number; label?: string }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      {label && <span className="ring-label">{label}</span>}
    </span>
  );
}

export function Spinner() {
  return <span className="spinner" role="status" aria-label="loading" />;
}

// ---------- toast ----------
interface ToastItem { id: number; text: string; kind: 'info' | 'ok' | 'error' }
const toasts = createStore<ToastItem[]>([]);
let toastId = 0;
export function toast(text: string, kind: ToastItem['kind'] = 'info') {
  const id = ++toastId;
  toasts.set((l) => [...l, { id, text, kind }]);
  setTimeout(() => toasts.set((l) => l.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3500);
}
export function Toaster() {
  const list = useSyncExternalStore(toasts.subscribe, toasts.get);
  return (
    <div className="toaster" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
      ))}
    </div>
  );
}

// ---------- overlays ----------
// Only the topmost overlay reacts to Escape (stacked modals must close one at a time).
const escStack: symbol[] = [];
export function useEscape(onClose: () => void, active = true) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const id = Symbol('overlay');
    escStack.push(id);
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && escStack[escStack.length - 1] === id) closeRef.current(); };
    window.addEventListener('keydown', h);
    return () => { window.removeEventListener('keydown', h); const i = escStack.indexOf(id); if (i >= 0) escStack.splice(i, 1); };
  }, [active]);
}

/** Modal Dialog on wide screens, bottom Sheet on phones (CSS decides). Scrim dismisses. */
export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEscape(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="close"><Icon name="close" /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

/** Nav Drawer / Sheet that slides from the given side over a scrim. */
export function Drawer({ side, onClose, children, label }: { side: 'right' | 'left'; onClose: () => void; children: ReactNode; label: string }) {
  useEscape(onClose);
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return (
    <div className="scrim scrim-drawer" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <nav className={`drawer drawer-${side}`} aria-label={label}>{children}</nav>
    </div>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'tab on' : 'tab'} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <section className="empty">
      <div className="empty-art" aria-hidden="true"><Icon name="folder" size={40} /></div>
      <h2>{title}</h2>
      <p>{text}</p>
      {action}
    </section>
  );
}

/** True while the viewport is at most `px` wide (phones / narrow windows). */
export function useNarrow(px = 760): boolean {
  const q = `(max-width: ${px}px)`;
  const [v, setV] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setV(m.matches);
    m.addEventListener('change', h);
    h();
    return () => m.removeEventListener('change', h);
  }, [q]);
  return v;
}
