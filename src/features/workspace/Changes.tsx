import { useMemo, useState } from 'react';
import type { ChangeRecord, Project } from '../../types';
import { Modal } from '../../components/ui';
import { diffLines, diffStats } from '../../lib/diff';

function when(at: number) {
  try { return new Date(at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }); } catch { return ''; }
}

function FileDiff({ f }: { f: ChangeRecord['files'][number] }) {
  const lines = useMemo(() => diffLines(f.before ?? '', f.after ?? ''), [f]);
  const st = useMemo(() => diffStats(f.before ?? '', f.after ?? ''), [f]);
  const tag = f.before === null ? 'ملف جديد' : f.after === null ? 'اتمسح' : '';
  return (
    <details className="diff-file" open={st.added + st.removed <= 120}>
      <summary dir="ltr"><span className="mono">{f.path}</span> {tag && <span className="badge">{tag}</span>} <span className="diff-add">+{st.added}</span> <span className="diff-del">−{st.removed}</span></summary>
      <div className="diff" dir="ltr" data-testid="diff-view">
        {lines.map((l, i) => (
          <div key={i} className={`diff-line ${l.kind}`}>
            <span className="ln">{l.a ?? ''}</span><span className="ln">{l.b ?? ''}</span>
            <span className="sign">{l.kind === 'add' ? '+' : l.kind === 'del' ? '−' : ' '}</span>
            <code>{l.text}</code>
          </div>
        ))}
      </div>
    </details>
  );
}

/** "What was changed": per edit/fix, every touched file as a before→after line diff. */
export function ChangesModal({ project, onClose, focus }: { project: Project; onClose: () => void; focus?: string }) {
  const list = useMemo(() => [...(project.changes ?? [])].reverse(), [project.changes]);
  const [sel, setSel] = useState(focus ?? list[0]?.id ?? '');
  const cur = list.find((c) => c.id === sel) ?? list[0];
  return (
    <Modal title="التغييرات (قبل / بعد)" onClose={onClose} wide>
      {list.length === 0 ? (
        <p className="muted" data-testid="no-changes">لسه مفيش تغييرات متسجلة. أي تعديل أو إصلاح هيظهر هنا بالسطر قبل وبعد.</p>
      ) : (
        <div className="changes">
          <ul className="change-list" role="list">
            {list.map((c) => (
              <li key={c.id}>
                <button className={c.id === cur?.id ? 'btn on block' : 'btn block'} onClick={() => setSel(c.id)} data-testid="change-item">
                  <span>{c.kind === 'fix' ? '🔧' : '✏️'} {c.label}</span>
                  <small className="muted"> {when(c.at)} · {c.files.length} ملف</small>
                </button>
              </li>
            ))}
          </ul>
          {cur && <div className="change-body">{cur.files.map((f) => <FileDiff key={f.path} f={f} />)}</div>}
        </div>
      )}
    </Modal>
  );
}
