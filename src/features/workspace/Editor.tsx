import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from '../../lib/highlight';
import { languageOf } from '../../lib/lang';
import { Icon } from '../../components/ui';
import { diffLines, diffStats } from '../../lib/diff';

interface Props {
  path: string;
  content: string;
  /** Text currently being streamed into this file (live writing), if any. */
  draft?: string;
  onSave: (content: string) => void;
  /** Content before the AI's pending changes (null = new file). Undefined = nothing pending for this file. */
  base?: string | null;
}

export function Editor({ path, content, draft, onSave, base }: Props) {
  const [view, setView] = useState<'diff' | 'code'>('diff');
  useEffect(() => { setView('diff'); }, [path]);
  const live = draft !== undefined;
  const [editing, setEditing] = useState(false);
  const [buf, setBuf] = useState(content);
  const [follow, setFollow] = useState(true);
  const [paused, setPaused] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => { setEditing(false); setBuf(content); setPaused(null); }, [path]);
  useEffect(() => { if (!editing) setBuf(content); }, [content, editing]);
  useEffect(() => { if (!live) setPaused(null); }, [live]);

  const shown = paused ?? (live ? draft! : content);
  // While live, characters are appended straight to the DOM (no re-highlighting, no giant React diff), so the editor
  // keeps pace with a fast model; syntax highlighting is applied once the file is finished.
  const text = live ? '' : shown;
  const lang = languageOf(path);
  const html = useMemo(() => (live ? '' : highlight(text, lang)), [text, lang, live]);
  const lines = text === '' ? 1 : text.split('\n').length;
  const changed = base !== undefined && !live;
  const showDiff = changed && view === 'diff' && !editing;
  const dlines = useMemo(() => (showDiff ? diffLines(base ?? '', content, 4) : []), [showDiff, base, content]);
  const dstat = useMemo(() => (changed ? diffStats(base ?? '', content) : { added: 0, removed: 0 }), [changed, base, content]);

  const liveCode = useRef<HTMLElement>(null);
  const liveGutter = useRef<HTMLDivElement>(null);
  const rendered = useRef({ text: '', lines: 0 });
  useEffect(() => {
    const code = liveCode.current, gut = liveGutter.current;
    if (!live || !code || !gut) { rendered.current = { text: '', lines: 0 }; return; }
    const r = rendered.current;
    if (!shown.startsWith(r.text)) { code.textContent = ''; gut.textContent = ''; r.text = ''; r.lines = 0; }
    const add = shown.slice(r.text.length);
    if (add || r.lines === 0) {
      if (add) code.appendChild(document.createTextNode(add));
      r.text = shown;
      const total = shown.split('\n').length;
      if (total > r.lines) {
        const frag = document.createDocumentFragment();
        for (let n = r.lines + 1; n <= total; n++) { const s = document.createElement('span'); s.textContent = String(n); frag.appendChild(s); }
        gut.appendChild(frag);
        r.lines = total;
      }
    }
    if (follow && !paused && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [shown, live, follow, paused]);

  return (
    <div className="editor" data-testid="editor" data-live={live ? '1' : '0'}>
      <div className="editor-bar">
        <span className="editor-path mono" dir="ltr">{path}</span>
        {live && <span className="live-badge" data-testid="live-badge"><span className="live-dot" /> بيكتب لايف</span>}
        {changed && <span className="tree-diff" dir="ltr"><span className="diff-add">+{dstat.added}</span><span className="diff-del">−{dstat.removed}</span></span>}
        <span className="spacer" />
        {changed && !editing && (
          <button className="btn sm" onClick={() => setView(view === 'diff' ? 'code' : 'diff')} data-testid="diff-toggle">{view === 'diff' ? 'الكود كامل' : 'عرض التغييرات'}</button>
        )}
        {live ? (
          <>
            <button className={follow ? 'btn sm on' : 'btn sm'} onClick={() => setFollow(!follow)} aria-pressed={follow}>متابعة</button>
            <button className="btn sm" onClick={() => setPaused(paused === null ? draft ?? '' : null)}>{paused === null ? 'إيقاف مؤقت' : 'استكمال'}</button>
          </>
        ) : editing ? (
          <>
            <button className="btn sm" onClick={() => { setBuf(content); setEditing(false); }}>إلغاء</button>
            <button className="btn sm primary" onClick={() => { onSave(buf); setEditing(false); }}><Icon name="check" size={14} /> حفظ</button>
          </>
        ) : (
          <button className="btn sm" onClick={() => setEditing(true)}><Icon name="edit" size={14} /> تعديل</button>
        )}
      </div>
      {editing && !live ? (
        <textarea className="editor-area mono" dir="ltr" spellCheck={false} value={buf} onChange={(e) => setBuf(e.target.value)} data-testid="editor-textarea" />
      ) : showDiff ? (
        <div className="editor-scroll diff-pane" dir="ltr" data-testid="diff-view">
          {base === null && <div className="diff-note">ملف جديد</div>}
          {dlines.map((l, i) => (
            <div key={i} className={`diff-line ${l.kind}${l.a === undefined && l.b === undefined ? ' gap' : ''}`}>
              <span className="ln">{l.a ?? ''}</span><span className="ln">{l.b ?? ''}</span>
              <span className="sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
              <code>{l.text}</code>
            </div>
          ))}
        </div>
      ) : live ? (
        <div className="editor-scroll" ref={scroller} dir="ltr">
          <div className="gutter" aria-hidden="true" ref={liveGutter} />
          <pre className="code mono" data-testid="code"><code ref={liveCode} /><span className="caret" /></pre>
        </div>
      ) : (
        <div className="editor-scroll" ref={scroller} dir="ltr">
          <div className="gutter" aria-hidden="true">{Array.from({ length: Math.min(lines, 5000) }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
          <pre className="code mono" data-testid="code"><code dangerouslySetInnerHTML={{ __html: html + '\n' }} /></pre>
        </div>
      )}
    </div>
  );
}
