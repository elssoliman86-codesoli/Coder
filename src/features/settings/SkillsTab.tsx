import { useMemo, useRef, useState } from 'react';
import { useApp, setState } from '../../storage/store';
import { Field, Icon, Modal, Spinner, toast } from '../../components/ui';
import { BUILTIN_SKILLS } from '../../skills/builtin';
import { parseSkillsMd, selectSkills, serializeSkills } from '../../skills/router';
import { importSkillsFromGithub } from '../../skills/github';
import { GithubClient } from '../../github/client';
import { runSkillCheck } from '../../runtime';
import { errMsg } from '../../lib/util';
import type { Skill, SkillCheck } from '../../types';

const VERDICT: Record<SkillCheck['verdict'], { label: string; cls: string; hint: string }> = {
  effective: { label: 'شغّالة ✓', cls: 'badge-ok', hint: 'الموديل نفّذ تعليماتها فعلًا، وأحسن من غيرها' },
  neutral: { label: 'مفيش فرق', cls: 'badge-warn', hint: 'النتيجة نفسها بدونها — الموديل أصلًا بيعمل كده أو المهارة مش بتضيف' },
  weak: { label: 'ضعيفة', cls: 'badge-warn', hint: 'اتنفّذ جزء من تعليماتها بس' },
  ineffective: { label: 'مش شغّالة ✗', cls: 'badge-error', hint: 'الموديل ما التزمش بتعليماتها حتى لما اتحقنت' },
};

const BUILTIN_FOLDER = 'مدمجة';
const MINE_FOLDER = 'مهاراتي';

export function SkillsTab() {
  const user = useApp((s) => s.userSkills);
  const disabled = useApp((s) => s.disabledSkills);
  const stats = useApp((s) => s.skillStats);
  const checks = useApp((s) => s.skillChecks);
  const token = useApp((s) => s.github.token);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Skill | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({});
  const file = useRef<HTMLInputElement>(null);

  const all: Skill[] = useMemo(() => [...BUILTIN_SKILLS.map((s) => ({ ...s, enabled: !disabled.includes(s.name), folder: BUILTIN_FOLDER })), ...user.map((s) => ({ ...s, folder: s.folder ?? MINE_FOLDER }))], [user, disabled]);
  const ql = q.trim().toLowerCase();
  const rows = all.filter((s) => !ql || (s.name + s.description + s.triggers.join(' ')).toLowerCase().includes(ql));
  const groups = useMemo(() => {
    const m = new Map<string, Skill[]>();
    for (const s of rows) m.set(s.folder!, [...(m.get(s.folder!) ?? []), s]);
    return [...m].sort((a, b) => Number(a[0] === BUILTIN_FOLDER) - Number(b[0] === BUILTIN_FOLDER) || a[0].localeCompare(b[0]));
  }, [rows]);

  const toggle = (s: Skill) =>
    setState((st) => {
      if (s.builtin) st.disabledSkills = s.enabled ? [...st.disabledSkills, s.name] : st.disabledSkills.filter((n) => n !== s.name);
      else st.userSkills = st.userSkills.map((x) => (x.name === s.name ? { ...x, enabled: !x.enabled } : x));
    });
  const toggleFolder = (list: Skill[], on: boolean) => list.forEach((s) => { if (s.enabled !== on) toggle(s); });

  async function importGithub() {
    if (!url.trim()) return;
    setBusy('بيقرأ الريبو…');
    try {
      const r = await importSkillsFromGithub(new GithubClient(token), url, setBusy);
      setState((st) => {
        const keep = st.userSkills.filter((s) => !(s.source?.repo === r.repo) && !r.skills.some((n) => n.name === s.name));
        st.userSkills = [...keep, ...r.skills];
      });
      setOpenFolders((o) => ({ ...o, [r.repo]: true }));
      setUrl('');
      toast(`تم استيراد ${r.skills.length} مهارة من ${r.repo}${r.truncated ? ' (الريبو كبير — ممكن يكون في مهارات ناقصة)' : ''}`, 'ok');
    } catch (e) {
      toast(errMsg(e), 'error');
    } finally {
      setBusy('');
    }
  }

  function exportMd() {
    const blob = new Blob([serializeSkills(all)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'skills.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function importMd(f: File) {
    const skills = parseSkillsMd(await f.text());
    if (!skills.length) { toast('الملف مفيهوش مهارات بصيغة skills.md', 'error'); return; }
    setState((st) => {
      const map = new Map(st.userSkills.map((s) => [s.name, s]));
      for (const s of skills) if (!BUILTIN_SKILLS.some((b) => b.name === s.name)) map.set(s.name, s);
      st.userSkills = [...map.values()];
    });
    toast(`تم استيراد ${skills.length} مهارة`, 'ok');
  }

  return (
    <div className="stack">
      <section className="card stack" data-ui="card">
        <strong>استيراد مهارات من GitHub</strong>
        <p className="muted small">الصق رابط ريبو فيه مجلدات مهارات (كل مجلد فيه SKILL.md). بتنزل كمجلد واحد وتقدر تفتح ملفاتها.</p>
        <div className="row">
          <input className="input mono" dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo" data-testid="skills-url" onKeyDown={(e) => { if (e.key === 'Enter') void importGithub(); }} />
          <button className="btn primary" onClick={() => void importGithub()} disabled={!!busy || !url.trim()} data-testid="skills-import">{busy ? <><Spinner /> {busy}</> : <><Icon name="github" size={16} /> استيراد</>}</button>
        </div>
      </section>

      <div className="filters">
        <input className="input" placeholder="بحث في المهارات…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => setOpen({ name: '', description: '', appliesTo: ['website'], triggers: [], always: false, enabled: true, builtin: false, body: '', folder: MINE_FOLDER })} data-testid="add-skill"><Icon name="plus" size={16} /> مهارة</button>
        <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> skills.md</button>
        <button className="btn" onClick={exportMd}>تصدير</button>
        <input ref={file} type="file" accept=".md,text/markdown" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importMd(f); e.target.value = ''; }} />
      </div>

      <div className="skill-folders" data-testid="skill-list">
        {groups.map(([folder, list]) => {
          const isOpen = !!ql || !!openFolders[folder];
          const on = list.filter((s) => s.enabled).length;
          const imported = list[0]?.source?.repo === folder;
          return (
            <section key={folder} className="skill-folder">
              <div className="skill-folder-head">
                <button className="tree-row" onClick={() => setOpenFolders((o) => ({ ...o, [folder]: !o[folder] }))} aria-expanded={isOpen} data-testid="skill-folder">
                  <span className={isOpen ? 'tri open' : 'tri'} aria-hidden="true">▸</span>
                  <Icon name="folder" size={18} />
                  <strong dir="auto">{folder}</strong>
                  <span className="badge">{on}/{list.length}</span>
                </button>
                <button className="btn sm" onClick={() => toggleFolder(list, on !== list.length)}>{on === list.length ? 'إيقاف الكل' : 'تفعيل الكل'}</button>
                {!BUILTIN_SKILLS.some((b) => b.name === list[0].name) && (
                  <button className="icon-btn" aria-label="حذف المجلد" onClick={() => { if (confirm(`حذف مجلد ${folder} (${list.length} مهارة)؟`)) setState((st) => { const names = new Set(list.map((s) => s.name)); st.userSkills = st.userSkills.filter((s) => !names.has(s.name)); }); }}><Icon name="trash" size={16} /></button>
                )}
                {imported && <span className="muted small" dir="ltr">{list[0].source!.ref}</span>}
              </div>
              {isOpen && (
                <ul className="skill-list">
                  {list.map((s) => {
                    const c = checks[s.name];
                    const used = stats[s.name]?.used ?? 0;
                    return (
                      <li key={s.name} className="skill-row">
                        <label className="switch"><input type="checkbox" role="switch" checked={s.enabled} onChange={() => toggle(s)} aria-label={s.name} /></label>
                        <button className="skill-open" onClick={() => setOpen(s)} data-testid="skill-open">
                          <strong className="mono" dir="ltr">{s.name}</strong>
                          {s.always && <span className="badge">always</span>}
                          {used > 0 && <span className="badge badge-ok" title="اتحقنت في طلبات للموديل">استُخدمت {used}×</span>}
                          {c && <span className={`badge ${VERDICT[c.verdict].cls}`}>{VERDICT[c.verdict].label}</span>}
                          <span className="muted small skill-desc">{s.description}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {groups.length === 0 && <p className="muted center">مفيش مهارات بالبحث ده</p>}
      </div>
      {open && <SkillViewer skill={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

const SKILL_MD = 'SKILL.md';

function SkillViewer({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [s, setS] = useState(skill);
  const [sel, setSel] = useState(SKILL_MD);
  const [testText, setTestText] = useState('');
  const [step, setStep] = useState('');
  const [err, setErr] = useState('');
  const check = useApp((s2) => s2.skillChecks[skill.name]);
  const used = useApp((s2) => s2.skillStats[skill.name]?.used ?? 0);
  const ro = skill.builtin;
  const isNew = !skill.name;
  const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const valid = /^[a-z0-9-]+$/.test(s.name) && s.body.trim().length > 0;
  const files = [{ path: SKILL_MD, content: s.body }, ...(s.files ?? [])];
  const current = files.find((f) => f.path === sel) ?? files[0];
  const would = testText.trim() ? selectSkills([{ ...s, enabled: true }], testText, 'any').length > 0 : null;

  async function test() {
    setErr('');
    setStep('بيبدأ…');
    try { await runSkillCheck({ ...s, enabled: true }, setStep); } catch (e) { setErr(errMsg(e)); }
    setStep('');
  }

  const setContent = (v: string) => setS((cur) => (sel === SKILL_MD ? { ...cur, body: v } : { ...cur, files: (cur.files ?? []).map((f) => (f.path === sel ? { ...f, content: v } : f)) }));

  return (
    <Modal title={ro ? skill.name : isNew ? 'مهارة جديدة' : skill.name} onClose={onClose} wide footer={ro ? undefined : (
      <>
        <button className="btn" onClick={onClose}>إلغاء</button>
        <button className="btn primary" disabled={!valid} onClick={() => { setState((st) => { st.userSkills = [...st.userSkills.filter((x) => x.name !== skill.name && x.name !== s.name), { ...s, autoTriggers: s.autoTriggers && s.triggers.join() === skill.triggers.join() }]; }); onClose(); }}>حفظ</button>
      </>
    )}>
      <div className="stack">
        {!isNew && <p className="muted small">{used > 0 ? `اتحقنت في ${used} طلب للموديل.` : 'لسه ما اتحقنتش في أي طلب — هتتفعّل لما وصف المشروع أو التعديل يطابق كلماتها (triggers) أو تبقى always.'}</p>}
        <div className="form-grid">
          <Field label="name" hint="حروف إنجليزية صغيرة وأرقام و -"><input className="input mono" dir="ltr" disabled={ro || !isNew && !!skill.source} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
          <Field label="description"><input className="input" disabled={ro} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></Field>
          <Field label="applies_to"><input className="input mono" dir="ltr" disabled={ro} value={s.appliesTo.join(', ')} onChange={(e) => setS({ ...s, appliesTo: csv(e.target.value) })} /></Field>
          <Field label="triggers (كلمات بتفعّل المهارة)"><input className="input" disabled={ro} value={s.triggers.join(', ')} onChange={(e) => setS({ ...s, triggers: csv(e.target.value) })} /></Field>
        </div>
        <label className="check"><input type="checkbox" disabled={ro} checked={s.always} onChange={(e) => setS({ ...s, always: e.target.checked })} /> always (تتحقن دايمًا)</label>
        {s.source && <p className="muted small" dir="ltr">source: {s.source.repo}/{s.source.path || '.'} @ {s.source.ref}</p>}

        <div className="skill-files">
          <ul className="skill-file-list" role="list">
            {files.map((f) => <li key={f.path}><button className={f.path === sel ? 'btn sm on block' : 'btn sm block'} dir="ltr" onClick={() => setSel(f.path)} data-testid="skill-file">{f.path}</button></li>)}
          </ul>
          <textarea className="input textarea mono" dir="auto" rows={14} readOnly={ro} value={current.content} onChange={(e) => setContent(e.target.value)} data-testid="skill-content" />
        </div>

        <section className="card stack" data-ui="card">
          <strong>هل المهارة هتتفعّل؟</strong>
          <input className="input" value={testText} onChange={(e) => setTestText(e.target.value)} placeholder="اكتب وصف مشروع أو طلب تعديل زي ما هتكتبه…" data-testid="skill-match-input" />
          {would !== null && <p className={would ? 'badge-ok' : 'muted'} data-testid="skill-match">{would ? '✓ المهارة دي هتتحقن في الطلب ده' : '✗ مش هتتفعّل لطلب زي ده (زوّد كلمات في triggers أو فعّل always)'}</p>}
        </section>

        <section className="card stack" data-ui="card">
          <div className="row">
            <strong>هل المهارة شغّالة فعلًا؟</strong>
            <span className="spacer" />
            <button className="btn primary sm" onClick={() => void test()} disabled={!!step || !s.body.trim()} data-testid="skill-test">{step ? <><Spinner /> {step}</> : 'اختبار المهارة'}</button>
          </div>
          <p className="muted small">بيطلب من الموديل مهمة صغيرة من تعليمات المهارة، وبينفّذها مرة بالمهارة ومرة من غيرها، وبعدين بيقيّم الاتنين على معايير مستخرجة من المهارة نفسها.</p>
          {err && <p className="field-error" role="alert">{err}</p>}
          {check && <CheckResult c={check} />}
        </section>
      </div>
    </Modal>
  );
}

function CheckResult({ c }: { c: SkillCheck }) {
  const v = VERDICT[c.verdict];
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  return (
    <div className="stack" data-testid="skill-check-result">
      <p><span className={`badge ${v.cls}`}>{v.label}</span> <span className="muted small">{v.hint}</span></p>
      <p className="small"><b>المهمة:</b> {c.task}</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>المعيار</th><th>بالمهارة ({pct(c.withSkill.score)})</th><th>من غيرها ({pct(c.withoutSkill.score)})</th></tr></thead>
          <tbody>{c.criteria.map((cr, i) => (
            <tr key={i}>
              <td>{cr}</td>
              <td title={c.withSkill.results[i]?.evidence}>{c.withSkill.results[i]?.met ? '✓' : '✗'}</td>
              <td title={c.withoutSkill.results[i]?.evidence}>{c.withoutSkill.results[i]?.met ? '✓' : '✗'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}


