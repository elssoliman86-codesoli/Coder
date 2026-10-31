import { useRef, useState } from 'react';
import type { Project, QueueItem } from '../../types';
import { useT } from '../../i18n';
import { Icon, Spinner } from '../../components/ui';
import { cancel, enqueue, moveQueue, processQueue, undoQueueItem, updateQueue } from '../../runtime';

const STATUS: Record<QueueItem['status'], string> = { queued: 'في الطابور', running: 'بيتنفذ', done: 'تم', failed: 'فشل', cancelled: 'اتلغى' };

function Chip({ project, item, first, last }: { project: Project; item: QueueItem; first: boolean; last: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.prompt);
  const id = project.id;
  return (
    <li className={`qchip q-${item.status}`} data-testid="queue-item" data-status={item.status}>
      {editing ? (
        <span className="qedit">
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} aria-label="edit prompt" />
          <button className="icon-btn" aria-label="save" onClick={() => { if (text.trim()) updateQueue(id, item.id, (q) => { q.prompt = text.trim(); }); setEditing(false); }}><Icon name="check" size={16} /></button>
        </span>
      ) : (
        <span className="qtext" title={item.prompt}>{item.status === 'running' && <Spinner />} {item.prompt}</span>
      )}
      <span className="badge">{STATUS[item.status]}</span>
      {item.status === 'done' && item.satisfied === true && <span className="badge badge-ok" title="راجع الموديل النتيجة مقابل طلبك">✓ اتراجع</span>}
      {item.status === 'done' && item.satisfied === false && <span className="badge badge-warn" title={(item.missing ?? []).join('\n')} data-testid="queue-missing">فيه نقص ({item.missing?.length ?? 0})</span>}
      {item.status === 'queued' && (
        <span className="qacts">
          <button className="icon-btn" aria-label="up" disabled={first} onClick={() => moveQueue(id, item.id, -1)}><Icon name="up" size={16} /></button>
          <button className="icon-btn" aria-label="down" disabled={last} onClick={() => moveQueue(id, item.id, 1)}><Icon name="down" size={16} /></button>
          <button className="icon-btn" aria-label="edit" onClick={() => setEditing(!editing)}><Icon name="edit" size={16} /></button>
          <button className="icon-btn" aria-label="run now" onClick={() => void processQueue(id, item.id)}><Icon name="play" size={16} /></button>
          <button className="icon-btn" aria-label="cancel item" onClick={() => updateQueue(id, item.id, (q) => { q.status = 'cancelled'; })}><Icon name="close" size={16} /></button>
        </span>
      )}
      {item.status === 'running' && <button className="icon-btn" aria-label="stop" onClick={() => cancel(id)}><Icon name="stop" size={16} /></button>}
      {item.status === 'done' && !item.undone && item.filesTouched.length > 0 && (
        <button className="btn sm" onClick={() => undoQueueItem(id, item.id)}><Icon name="undo" size={14} /> تراجع</button>
      )}
      {item.understanding && <span className="qunder muted small" data-testid="queue-understanding">فهمت: {item.understanding}</span>}
      {item.status === 'done' && item.satisfied === false && item.missing && item.missing.length > 0 && <ul className="qmissing small">{item.missing.slice(0, 4).map((m, i) => <li key={i}>{m}</li>)}</ul>}
      {item.error && item.status === 'failed' && <span className="field-error small">{item.error}</span>}
    </li>
  );
}

export const PROMPT_INPUT_ID = 'prompt-input';

export function PromptBar({ project, disabled }: { project: Project; disabled?: boolean }) {
  const t = useT();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const visible = project.queue.filter((q) => q.status !== 'cancelled' || false).slice(-6);
  const send = () => {
    const v = text.trim();
    if (!v || disabled) return;
    enqueue(project.id, v);
    setText('');
  };
  return (
    <div className="promptbar" data-testid="promptbar">
      {visible.length > 0 && (
        <ul className="queue" aria-label={t('queue')}>
          {visible.map((q, i) => <Chip key={q.id} project={project} item={q} first={i === 0} last={i === visible.length - 1} />)}
        </ul>
      )}
      <div className="promptrow">
        <textarea id={PROMPT_INPUT_ID} ref={ref} className="input prompt" rows={1} value={text} placeholder={t('promptPlaceholder')} disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} data-testid="prompt-input" />
        <button className="icon-btn primary" aria-label={t('send')} onClick={send} disabled={!text.trim() || disabled} data-testid="prompt-send"><Icon name="send" /></button>
      </div>
    </div>
  );
}
