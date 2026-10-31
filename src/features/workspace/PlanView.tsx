import type { Project } from '../../types';
import { Icon, Modal, Spinner, toast } from '../../components/ui';
import { useRuntime } from '../../runtime';

export const PLAN_DRAFT_PATH = 'PLAN.json';

const TYPE_LABEL: Record<string, string> = { website: 'موقع ثابت', webapp: 'تطبيق ويب (framework)', backend: 'Backend / API', apk: 'تطبيق موبايل', cli: 'أداة سطر أوامر', exe: 'برنامج سطح مكتب', library: 'مكتبة' };

/** Readable, clickable view of the plan (live raw JSON while the Planner is still writing it). */
export function PlanModal({ project, onClose, onOpenFile }: { project: Project; onClose: () => void; onOpenFile: (path: string) => void }) {
  const draft = useRuntime((r) => r.drafts[project.id]?.[PLAN_DRAFT_PATH]);
  const plan = project.plan;
  const have = new Set(project.files.map((f) => f.path));
  const copy = () => { void navigator.clipboard?.writeText(project.planMd ?? '').then(() => toast('تم نسخ الخطة', 'ok')); };

  if (!plan) {
    return (
      <Modal title="الخطة" onClose={onClose} wide>
        {draft !== undefined || project.status === 'planning' ? (
          <div className="stack" data-testid="plan-live">
            <p className="muted"><Spinner /> الـ Planner بيكتب الخطة دلوقتي…</p>
            <pre className="log mono small" dir="ltr" style={{ maxHeight: '50dvh' }}>{draft ?? ''}</pre>
          </div>
        ) : <p className="muted">لسه مفيش خطة. ابدأ المشروع أو اضغط «إعادة المحاولة».</p>}
      </Modal>
    );
  }
  return (
    <Modal title={`الخطة — ${project.name}`} onClose={onClose} wide footer={<>{project.planMd && <button className="btn" onClick={copy}><Icon name="copy" size={14} /> نسخ Markdown</button>}{have.has('PLAN.md') && <button className="btn" onClick={() => { onOpenFile('PLAN.md'); onClose(); }}>افتح PLAN.md</button>}<button className="btn primary" onClick={onClose}>إغلاق</button></>}>
      <div className="plan stack" data-testid="plan-view">
        <p>{plan.summary}</p>
        <div className="row">
          <span className="badge">{TYPE_LABEL[plan.type] ?? plan.type}</span>
          <span className="badge">{plan.primaryLanguage}</span>
          <span className="badge">{plan.files.length} ملف</span>
          <span className="badge">{plan.functions.length} دالة</span>
          {plan.targetUsers && <span className="badge">المستخدمين: {plan.targetUsers}</span>}
        </div>

        <details open><summary>التقنيات</summary>
          <div className="table-wrap"><table className="table"><thead><tr><th>الفئة</th><th>الاختيار</th><th>الإصدار</th><th>السبب</th></tr></thead>
            <tbody>{plan.stack.map((s, i) => <tr key={i}><td>{s.category}</td><td className="mono" dir="ltr">{s.choice}</td><td className="mono" dir="ltr">{s.version}{!s.verified && ' (غير مؤكد)'}</td><td>{s.reason}</td></tr>)}</tbody></table></div>
        </details>

        <details open><summary>الملفات ({plan.files.length})</summary>
          <ul className="plan-files">{plan.files.map((f) => (
            <li key={f.path}>
              {have.has(f.path) ? <button className="link mono" dir="ltr" onClick={() => { onOpenFile(f.path); onClose(); }}>{f.path}</button> : <span className="mono muted" dir="ltr">{f.path}</span>}
              <span className="muted"> — {f.purpose}</span>
              <ul>{plan.functions.filter((x) => x.file === f.path).map((x, i) => <li key={i}><code dir="ltr">{x.signature || x.name}</code> <span className="muted small">{x.description}</span></li>)}</ul>
            </li>
          ))}</ul>
        </details>

        {plan.screens.length > 0 && <details><summary>الشاشات ({plan.screens.length})</summary>
          <ul>{plan.screens.map((s, i) => <li key={i}><b>{s.name}</b> <code dir="ltr">{s.route}</code> {s.uiTerms.map((t) => <span key={t} className="badge">{t}</span>)}</li>)}</ul>
        </details>}

        <details><summary>التصميم</summary>
          <p><b>{plan.design.style}</b> — {plan.design.typography}</p>
          <div className="row">{Object.entries(plan.design.palette).map(([k, v]) => <span key={k} className="swatch" title={`${k} ${v}`}><i style={{ background: v }} />{k}<code dir="ltr">{v}</code></span>)}</div>
          <p className="muted small">{plan.design.spacing} · {plan.design.motion}</p>
        </details>

        {(['tests', 'risks', 'assumptions', 'openQuestions'] as const).map((k) => plan[k].length > 0 && (
          <details key={k}><summary>{{ tests: 'الاختبارات', risks: 'المخاطر', assumptions: 'الافتراضات', openQuestions: 'أسئلة مفتوحة' }[k]} ({plan[k].length})</summary>
            <ul>{plan[k].map((x, i) => <li key={i}>{x}</li>)}</ul>
          </details>
        ))}
      </div>
    </Modal>
  );
}
