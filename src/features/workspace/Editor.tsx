import { useEffect, useMemo, useRef, useState } from 'react';
import { highlight } from '../../lib/highlight';
import { languageOf } from '../../lib/lang';
import { Icon } from '../../components/ui';

/** Latest value, committed at most once per animation frame (keeps streaming smooth on mid-range phones). */
function useRafValue<T>(value: T): T {
  const [v, setV] = useState(value);
  const latest = useRef(value);
  const raf = useRef(0);
  latest.current = value;
  useEffect(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => { raf.current = 0; setV(latest.current); });
  }, [value]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return v;
}

interface Props {
  path: string;
  content: string;
  /** Text currently being streamed into this file (live writing), if any. */
  draft?: string;
  onSave: (content: string) => void;
}

export function Editor({ path, content, draft, onSave }: Props) {
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
  const text = useRafValue(shown);
  const lang = languageOf(path);
  const html = useMemo(() => highlight(text, lang), [text, lang]);
  const lines = text === '' ? 1 : text.split('\n').length;

  useEffect(() => {
    if (live && follow && !paused && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [text, live, follow, paused]);

  return (
    <div className="editor" data-testid="editor" data-live={live ? '1' : '0'}>
      <div className="editor-bar">
        <span className="editor-path mono" dir="ltr">{path}</span>
        {live && <span className="live-badge" data-testid="live-badge"><span className="live-dot" /> بيكتب لايف</span>}
        <span className="spacer" />
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
      ) : (
        <div className="editor-scroll" ref={scroller} dir="ltr">
          <div className="gutter" aria-hidden="true">{Array.from({ length: Math.min(lines, 5000) }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
          <pre className="code mono" data-testid="code"><code dangerouslySetInnerHTML={{ __html: html + (live ? '<span class="caret"></span>' : '') + '\n' }} /></pre>
        </div>
      )}
    </div>
  );
}
