import { useMemo, useRef, useState } from 'react';
import { useApp, setState } from '../../storage/store';
import { useT } from '../../i18n';
import { Field, Icon, Modal, StatusDot, Tabs, toast } from '../../components/ui';
import { PROVIDER_PRESETS, listModels, probeModel } from '../../llm/client';
import { GithubClient, REQUIRED_PERMISSIONS } from '../../github/client';
import { BUILTIN_SKILLS } from '../../skills/builtin';
import { parseSkillsMd, serializeSkills } from '../../skills/router';
import { errMsg, fmtNum, fmtPrice, pool, uid } from '../../lib/util';
import { ROLES, type GithubState, type ModelInfo, type Provider, type Role, type Skill } from '../../types';

type Tab = 'provider' | 'github' | 'skills' | 'about';

export function Settings({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('provider');
  return (
    <Modal title={t('settings')} onClose={onClose} wide>
      <Tabs<Tab> tabs={[{ id: 'provider', label: t('provider') }, { id: 'github', label: t('github') }, { id: 'skills', label: t('skills') }, { id: 'about', label: t('about') }]} value={tab} onChange={setTab} />
      <div className="tab-panel">
        {tab === 'provider' && <ProviderTab />}
        {tab === 'github' && <GithubTab />}
        {tab === 'skills' && <SkillsTab />}
        {tab === 'about' && <AboutTab />}
      </div>
    </Modal>
  );
}

// ---------- provider ----------

function ProviderTab() {
  const t = useT();
  const providers = useApp((s) => s.providers);
  const add = () =>
    setState((s) => {
      s.providers = [...s.providers, { id: uid('prv'), name: '', provider: 'custom', baseUrl: '', apiKey: '', models: [], isDefault: s.providers.length === 0 }];
    });
  return (
    <div className="stack">
      {providers.length === 0 && <p className="muted">لسه مفيش مزود. أضف كارت وافتح قايمة الموديلات.</p>}
      {providers.map((p) => <ProviderCard key={p.id} p={p} />)}
      <button className="btn" onClick={add} data-testid="add-provider"><Icon name="plus" size={16} /> {t('provider')}</button>
      <RolesCard />
    </div>
  );
}

function updateProvider(id: string, fn: (p: Provider) => void) {
  setState((s) => {
    s.providers = s.providers.map((p) => {
      if (p.id !== id) return p;
      const c = structuredClone(p);
      fn(c);
      return c;
    });
  });
}

function ProviderCard({ p }: { p: Provider }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; ok: number } | null>(null);
  const stopRef = useRef<AbortController | null>(null);
  const set = (k: keyof Provider, v: string) => updateProvider(p.id, (x) => { (x as any)[k] = v; });
  const ep = { baseUrl: p.baseUrl, apiKey: p.apiKey };

  async function list() {
    setErr('');
    if (!p.baseUrl) { setErr('اكتب الـ Base URL'); return; }
    setLoading(true);
    try {
      const models = await listModels(ep);
      const old = new Map(p.models.map((m) => [m.id, m]));
      updateProvider(p.id, (x) => { x.models = models.map((m) => ({ ...m, starred: old.get(m.id)?.starred, status: 'testing' as const })); });
      setOpen(true);
      await verify(models.map((m) => m.id));
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  /** Probes every listed model (HTTP 200?) and keeps only the ones that answer — the list then only holds working models. */
  async function verify(ids: string[]) {
    const ac = new AbortController();
    stopRef.current = ac;
    let done = 0;
    setProgress({ done: 0, total: ids.length, ok: 0 });
    let ok = 0;
    await pool(ids, 6, async (id) => {
      const r = await probeModel(ep, id, {}, ac.signal).catch(() => ({ ok: false, code: 0, error: 'cancelled' }));
      if (ac.signal.aborted) return;
      if (r.ok) { ok++; updateProvider(p.id, (x) => { const m = x.models.find((y) => y.id === id); if (m) { m.status = 'ok'; m.code = 200; m.error = undefined; } }); }
      else updateProvider(p.id, (x) => { x.models = x.models.filter((y) => y.id !== id); });
      setProgress({ done: ++done, total: ids.length, ok });
    }, ac.signal);
    // cancelled: whatever wasn't probed yet stays listed as untested
    updateProvider(p.id, (x) => { x.models.forEach((m) => { if (m.status === 'testing') m.status = 'untested'; }); });
    stopRef.current = null;
    toast(ac.signal.aborted ? `اتوقف الفحص — ${ok} موديل بيرد 200` : `تم الفحص — ${ok} موديل بيرد 200 من ${ids.length} (الباقي اتشال)`, ok ? 'ok' : 'error');
  }
  async function test() {
    setErr('');
    try { const m = await listModels(ep); toast(`الاتصال شغال — ${m.length} موديل`, 'ok'); } catch (e) { setErr(errMsg(e)); }
  }

  return (
    <section className="card provider-card" data-testid="provider-card">
      <div className="form-grid">
        <Field label={t('providerName')}><input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} data-testid="prov-name" /></Field>
        <Field label={t('providerKind')}>
          <select className="input" value={p.provider} onChange={(e) => {
            const preset = PROVIDER_PRESETS.find((x) => x.id === e.target.value);
            updateProvider(p.id, (x) => { x.provider = e.target.value; if (preset?.baseUrl) x.baseUrl = preset.baseUrl; if (!x.name && preset) x.name = preset.label; });
          }}>
            {PROVIDER_PRESETS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </Field>
        <Field label={t('baseUrl')}><input className="input mono" dir="ltr" value={p.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://…/v1" data-testid="prov-url" /></Field>
        <Field label={t('apiKey')} hint="بتتخزن مشفرة على الجهاز، ومابتظهرش في أي لوج."><input className="input mono" dir="ltr" type="password" autoComplete="off" value={p.apiKey} onChange={(e) => set('apiKey', e.target.value)} data-testid="prov-key" /></Field>
      </div>
      {p.provider === 'nvidia' && <p className="muted small">NVIDIA NIM مابيبعتش CORS headers: شغّال في الـ APK، لكن المتصفح (PWA) هيحجبه. وبعض الموديلات في القايمة مش مفعّلة لحسابك — استخدم «اختبار الظاهر» واختار اللي حالته 200.</p>}
      {err && <p className="field-error" role="alert">{err}</p>}
      <div className="row">
        <button className="btn primary" onClick={list} disabled={loading} data-testid="list-models">{loading ? (progress ? `بيفحص ${progress.done}/${progress.total} — ✓ ${progress.ok}` : '…') : t('listModels')}</button>
        {progress && <button className="btn danger" onClick={() => stopRef.current?.abort()} data-testid="stop-verify">إيقاف الفحص</button>}
        <button className="btn" onClick={test}>{t('testConnection')}</button>
        <button className="btn" onClick={() => setState((s) => { s.providers = s.providers.map((x) => ({ ...x, isDefault: x.id === p.id })); })} disabled={p.isDefault}>{p.isDefault ? 'الافتراضي' : 'اجعله افتراضي'}</button>
        <button className="btn danger" onClick={() => setState((s) => { s.providers = s.providers.filter((x) => x.id !== p.id); })} aria-label={t('delete')}><Icon name="trash" size={16} /></button>
      </div>
      {open && <ModelsModal p={p} onClose={() => setOpen(false)} />}
    </section>
  );
}

type Sort = 'id' | 'inputPrice' | 'outputPrice' | 'context' | 'maxOutput' | 'status';

function ModelsModal({ p, onClose }: { p: Provider; onClose: () => void }) {
  const live = useApp((s) => s.providers.find((x) => x.id === p.id)) ?? p;
  const [q, setQ] = useState('');
  const [only200, setOnly200] = useState(false);
  const [price, setPrice] = useState<'all' | 'free' | 'paid'>('all');
  const [minCtx, setMinCtx] = useState(0);
  const [sort, setSort] = useState<Sort>('id');
  const [asc, setAsc] = useState(true);
  const [running, setRunning] = useState(false);
  const stop = useRef<AbortController | null>(null);

  const rows = useMemo(() => {
    let r = live.models.filter((m) => m.id.toLowerCase().includes(q.toLowerCase()));
    if (only200) r = r.filter((m) => m.status === 'ok');
    if (price === 'free') r = r.filter((m) => m.inputPrice === 0 && m.outputPrice === 0);
    if (price === 'paid') r = r.filter((m) => (m.inputPrice ?? 0) > 0 || (m.outputPrice ?? 0) > 0);
    if (minCtx) r = r.filter((m) => (m.context ?? 0) >= minCtx);
    const val = (m: ModelInfo) => (sort === 'id' ? m.id : sort === 'status' ? (m.status === 'ok' ? 0 : m.status === 'error' ? 2 : 1) : m[sort] ?? -1);
    return [...r].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return asc ? c : -c;
    });
  }, [live.models, q, only200, price, minCtx, sort, asc]);

  const patchModel = (id: string, fn: (m: ModelInfo) => void) => updateProvider(p.id, (x) => { const m = x.models.find((y) => y.id === id); if (m) fn(m); });

  async function test(ids: string[]) {
    const ac = new AbortController();
    stop.current = ac;
    setRunning(true);
    ids.forEach((id) => patchModel(id, (m) => { m.status = 'testing'; }));
    await pool(ids, 4, async (id) => {
      const r = await probeModel({ baseUrl: p.baseUrl, apiKey: p.apiKey }, id, {}, ac.signal).catch(() => ({ ok: false, code: 0, error: 'cancelled' }));
      patchModel(id, (m) => { m.status = r.ok ? 'ok' : 'error'; m.code = r.code; m.error = r.error; });
    }, ac.signal);
    ids.forEach((id) => patchModel(id, (m) => { if (m.status === 'testing') m.status = 'untested'; }));
    setRunning(false);
  }

  const th = (k: Sort, label: string) => (
    <th aria-sort={sort === k ? (asc ? 'ascending' : 'descending') : 'none'}>
      <button className="th-btn" onClick={() => { if (sort === k) setAsc(!asc); else { setSort(k); setAsc(true); } }}>{label}{sort === k ? (asc ? ' ▲' : ' ▼') : ''}</button>
    </th>
  );

  return (
    <Modal title={`${live.name || 'Models'} — ${live.models.length}`} onClose={onClose} wide>
      <div className="filters" role="group" aria-label="filters">
        <input className="input" placeholder="بحث…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="model-search" />
        <label className="check"><input type="checkbox" checked={only200} onChange={(e) => setOnly200(e.target.checked)} data-testid="only-200" /> بيرد 200 بس</label>
        <div className="seg" role="group">
          {(['all', 'free', 'paid'] as const).map((k) => <button key={k} className={price === k ? 'seg-b on' : 'seg-b'} onClick={() => setPrice(k)}>{k === 'all' ? 'الكل' : k === 'free' ? 'مجاني' : 'مدفوع'}</button>)}
        </div>
        <select className="input" value={minCtx} onChange={(e) => setMinCtx(Number(e.target.value))} aria-label="min context">
          <option value={0}>أي سياق</option><option value={8000}>≥ 8K</option><option value={32000}>≥ 32K</option><option value={128000}>≥ 128K</option><option value={500000}>≥ 500K</option>
        </select>
        {running ? <button className="btn danger" onClick={() => stop.current?.abort()}>إيقاف</button> : <button className="btn" onClick={() => test(rows.map((m) => m.id))} data-testid="test-visible">اختبار الظاهر ({rows.length})</button>}
      </div>
      <div className="table-wrap">
        <table className="table" data-testid="models-table">
          <thead>
            <tr>{th('id', 'الموديل')}{th('inputPrice', 'سعر الدخل /1M')}{th('outputPrice', 'سعر الخرج /1M')}{th('context', 'السياق')}{th('maxOutput', 'أقصى خرج')}{th('status', 'الحالة')}<th>الإجراءات</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id} data-testid="model-row">
                <td className="mono" dir="ltr">{m.id}</td>
                <td className="num">{fmtPrice(m.inputPrice)}</td>
                <td className="num">{fmtPrice(m.outputPrice)}</td>
                <td className="num">{fmtNum(m.context)}</td>
                <td className="num">{fmtNum(m.maxOutput)}</td>
                <td>
                  <span className="status"><StatusDot status={m.status} label={m.status === 'ok' ? '200' : m.status === 'error' ? `HTTP ${m.code ?? '?'}` : m.status} /> {m.status === 'ok' ? '200' : m.status === 'error' ? (m.code ? m.code : 'خطأ') : m.status === 'testing' ? '…' : '—'}</span>
                  {m.status === 'error' && m.error && <span className="muted small" title={m.error}> {m.error.slice(0, 40)}</span>}
                </td>
                <td className="actions">
                  <button className="icon-btn" aria-label="test" onClick={() => test([m.id])}><Icon name="refresh" size={16} /></button>
                  <button className={m.starred ? 'icon-btn on' : 'icon-btn'} aria-label="star" aria-pressed={!!m.starred} onClick={() => patchModel(m.id, (x) => { x.starred = !x.starred; })}><Icon name="star" size={16} /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="muted center">مفيش نتائج بالفلاتر دي</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="muted small">السعر والسياق بيتقرأوا من رد المزود. لو المزود ما بعتهمش بنعرض «—» ومابنخمنش.</p>
    </Modal>
  );
}

const ROLE_LABEL: Record<Role, string> = { planner: 'Planner (الموديل الأساسي)', coder: 'Coder (يكتب الملفات بس)', critic: 'Visual Critic', fixer: 'Fixer', expert: 'Expert (فحص ونشر)' };

export function modelOptions(providers: Provider[]): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const p of providers) {
    const rank = (m: Provider['models'][number]) => (m.status === 'ok' ? 0 : m.status === 'error' ? 2 : 1);
    const sorted = [...p.models].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || rank(a) - rank(b) || a.id.localeCompare(b.id));
    for (const m of sorted) out.push({ value: `${p.id}::${m.id}`, label: `${m.starred ? '★ ' : ''}${m.status === 'ok' ? '✓ ' : m.status === 'error' ? '✗ ' : ''}${m.id} — ${p.name || p.provider}` });
  }
  return out;
}

function RolesCard() {
  const providers = useApp((s) => s.providers);
  const roles = useApp((s) => s.roles);
  const opts = modelOptions(providers);
  if (opts.length === 0) return null;
  return (
    <section className="card">
      <h3>الأدوار — كل وكيل بموديل متخصص</h3>
      <div className="form-grid">
        {ROLES.map((r) => (
          <Field key={r} label={ROLE_LABEL[r]}>
            <select className="input mono" dir="ltr" value={roles[r] ? `${roles[r]!.providerId}::${roles[r]!.modelId}` : ''} data-testid={`role-${r}`}
              onChange={(e) => { const [providerId, ...rest] = e.target.value.split('::'); setState((s) => { const next = { ...s.roles }; if (e.target.value) next[r] = { providerId, modelId: rest.join('::') }; else delete next[r]; s.roles = next; }); }}>
              <option value="">(الافتراضي)</option>
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        ))}
      </div>
    </section>
  );
}

// ---------- github ----------

const PLUGINS: { key: keyof GithubState['plugins']; label: string }[] = [
  { key: 'readRepo', label: 'قراءة الريبو' },
  { key: 'writeFiles', label: 'كتابة الملفات (commit)' },
  { key: 'createRepo', label: 'إنشاء ريبو' },
  { key: 'enablePages', label: 'تفعيل GitHub Pages' },
  { key: 'runActions', label: 'تشغيل وقراءة Actions' },
  { key: 'createReleases', label: 'إنشاء releases' },
];

function GithubTab() {
  const gh = useApp((s) => s.github);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function verify() {
    setErr('');
    setBusy(true);
    try {
      const u = await new GithubClient(gh.token).user();
      setState((s) => { s.github = { ...s.github, login: u.login, scopes: u.scopes, verifiedAt: Date.now() }; });
      const missing = u.scopes.length && !(u.scopes.includes('repo') && u.scopes.includes('workflow'));
      toast(missing ? `تم التحقق من ${u.login} — لكن ناقص صلاحية repo أو workflow` : `تم التحقق: ${u.login}`, missing ? 'error' : 'ok');
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="card">
        <Field label="GitHub token" hint="يفضل fine-grained personal access token. بيتخزن مشفر على الجهاز.">
          <input className="input mono" dir="ltr" type="password" autoComplete="off" value={gh.token} onChange={(e) => setState((s) => { s.github = { ...s.github, token: e.target.value, login: undefined, scopes: undefined }; })} data-testid="gh-token" />
        </Field>
        {err && <p className="field-error" role="alert">{err}</p>}
        <div className="row">
          <button className="btn primary" disabled={!gh.token || busy} onClick={verify} data-testid="gh-verify">Verify token</button>
          {gh.login && <span className="badge badge-ok">@{gh.login}</span>}
          {gh.scopes && gh.scopes.length > 0 && <span className="muted small" dir="ltr">{gh.scopes.join(', ')}</span>}
          {gh.scopes && gh.scopes.length === 0 && gh.login && <span className="muted small">fine-grained token (الصلاحيات بتتحدد من GitHub)</span>}
        </div>
        <h4>الصلاحيات المطلوبة</h4>
        <ul className="plain" dir="ltr">{REQUIRED_PERMISSIONS.map((r) => <li key={r}>{r}</li>)}</ul>
        <p className="muted small">التوكن الكلاسيكي محتاج صلاحيتي <code>repo</code> و<code>workflow</code>.</p>
      </section>
      <section className="card">
        <h3>Plugins</h3>
        <div className="switches">
          {PLUGINS.map((pl) => (
            <label key={pl.key} className="switch">
              <input type="checkbox" role="switch" checked={gh.plugins[pl.key]} onChange={(e) => setState((s) => { s.github = { ...s.github, plugins: { ...s.github.plugins, [pl.key]: e.target.checked } }; })} />
              <span>{pl.label}</span>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

// ---------- skills ----------

function SkillsTab() {
  const user = useApp((s) => s.userSkills);
  const disabled = useApp((s) => s.disabledSkills);
  const [q, setQ] = useState('');
  const [type, setType] = useState('all');
  const [edit, setEdit] = useState<Skill | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const all: Skill[] = [...BUILTIN_SKILLS.map((s) => ({ ...s, enabled: !disabled.includes(s.name) })), ...user];
  const rows = all.filter((s) => (type === 'all' || s.appliesTo.includes(type) || s.appliesTo.includes('*')) && (s.name + s.description + s.triggers.join(' ')).toLowerCase().includes(q.toLowerCase()));

  const toggle = (s: Skill) =>
    setState((st) => {
      if (s.builtin) st.disabledSkills = s.enabled ? [...st.disabledSkills, s.name] : st.disabledSkills.filter((n) => n !== s.name);
      else st.userSkills = st.userSkills.map((x) => (x.name === s.name ? { ...x, enabled: !x.enabled } : x));
    });

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
      <div className="filters">
        <input className="input" placeholder="بحث في المهارات…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="applies_to">
          {['all', 'website', 'webapp', 'backend', 'apk', 'cli', 'exe', 'library'].map((x) => <option key={x} value={x}>{x === 'all' ? 'كل الأنواع' : x}</option>)}
        </select>
        <button className="btn" onClick={() => setEdit({ name: '', description: '', appliesTo: ['website'], triggers: [], always: false, enabled: true, builtin: false, body: '' })} data-testid="add-skill"><Icon name="plus" size={16} /> مهارة</button>
        <button className="btn" onClick={() => file.current?.click()}><Icon name="upload" size={16} /> استيراد skills.md</button>
        <button className="btn" onClick={exportMd}>تصدير skills.md</button>
        <input ref={file} type="file" accept=".md,text/markdown" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importMd(f); e.target.value = ''; }} />
      </div>
      <ul className="skill-list" data-testid="skill-list">
        {rows.map((s) => (
          <li key={s.name} className="skill">
            <label className="switch"><input type="checkbox" role="switch" checked={s.enabled} onChange={() => toggle(s)} aria-label={s.name} /></label>
            <div className="skill-main">
              <strong className="mono" dir="ltr">{s.name}</strong> {s.always && <span className="badge">always</span>} {s.builtin && <span className="badge">built-in</span>}
              <p className="muted small">{s.description}</p>
              <p className="muted small" dir="ltr">applies_to: {s.appliesTo.join(', ')}{s.triggers.length ? ` · triggers: ${s.triggers.slice(0, 6).join(', ')}` : ''}</p>
            </div>
            <button className="icon-btn" aria-label="view" onClick={() => setEdit(s)}><Icon name={s.builtin ? 'file' : 'edit'} size={16} /></button>
            {!s.builtin && <button className="icon-btn" aria-label="delete" onClick={() => setState((st) => { st.userSkills = st.userSkills.filter((x) => x.name !== s.name); })}><Icon name="trash" size={16} /></button>}
          </li>
        ))}
      </ul>
      {edit && <SkillEditor skill={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function SkillEditor({ skill, onClose }: { skill: Skill; onClose: () => void }) {
  const [s, setS] = useState(skill);
  const ro = skill.builtin;
  const isNew = !skill.name;
  const csv = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);
  const valid = /^[a-z0-9-]+$/.test(s.name) && s.body.trim().length > 0;
  return (
    <Modal title={ro ? skill.name : isNew ? 'مهارة جديدة' : 'تعديل المهارة'} onClose={onClose} wide footer={ro ? undefined : (
      <>
        <button className="btn" onClick={onClose}>إلغاء</button>
        <button className="btn primary" disabled={!valid} onClick={() => { setState((st) => { st.userSkills = [...st.userSkills.filter((x) => x.name !== skill.name && x.name !== s.name), s]; }); onClose(); }}>حفظ</button>
      </>
    )}>
      <div className="form-grid">
        <Field label="name" hint="حروف إنجليزية صغيرة وأرقام و -"><input className="input mono" dir="ltr" disabled={ro} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} /></Field>
        <Field label="description"><input className="input" disabled={ro} value={s.description} onChange={(e) => setS({ ...s, description: e.target.value })} /></Field>
        <Field label="applies_to (website, apk, cli, exe, library)"><input className="input mono" dir="ltr" disabled={ro} value={s.appliesTo.join(', ')} onChange={(e) => setS({ ...s, appliesTo: csv(e.target.value) })} /></Field>
        <Field label="triggers (كلمات بتفعّل المهارة)"><input className="input" disabled={ro} value={s.triggers.join(', ')} onChange={(e) => setS({ ...s, triggers: csv(e.target.value) })} /></Field>
      </div>
      <label className="check"><input type="checkbox" disabled={ro} checked={s.always} onChange={(e) => setS({ ...s, always: e.target.checked })} /> always (تتحقن دايمًا)</label>
      <Field label="Instructions"><textarea className="input textarea mono" dir="auto" rows={12} disabled={ro} value={s.body} onChange={(e) => setS({ ...s, body: e.target.value })} /></Field>
    </Modal>
  );
}

// ---------- about ----------

function AboutTab() {
  const lang = useApp((s) => s.settings.language);
  const settings = useApp((s) => s.settings);
  return (
    <div className="stack">
      <section className="card">
        <h3>2OneByte-Coder <span className="muted small">v{__APP_VERSION__}</span></h3>
        <p>منشئ تطبيقات بالذكاء الاصطناعي: وكلاء متخصصين بيخططوا ويكتبوا لايف ويراجعوا بصريًا وينشروا على GitHub.</p>
        <div className="form-grid">
          <Field label="اللغة / Language">
            <select className="input" value={lang} onChange={(e) => setState((s) => { s.settings = { ...s.settings, language: e.target.value as 'ar' | 'en' }; })}>
              <option value="ar">العربية (RTL)</option><option value="en">English (LTR)</option>
            </select>
          </Field>
          <Field label="المظهر">
            <select className="input" value={settings.theme} data-testid="theme-select" onChange={(e) => setState((s) => { s.settings = { ...s.settings, theme: e.target.value as 'dark' | 'light' | 'system' }; })}>
              <option value="dark">داكن</option><option value="light">فاتح</option><option value="system">زي الجهاز</option>
            </select>
          </Field>
          <Field label="مدة المراقبة قبل قائمة المراجعة (ثواني)">
            <input className="input" type="number" min={5} max={600} value={settings.observeSeconds} data-testid="observe-seconds" onChange={(e) => setState((s) => { s.settings = { ...s.settings, observeSeconds: Math.max(3, Number(e.target.value) || 120) }; })} />
          </Field>
          <Field label="أقصى عدد دورات إصلاح للطلب">
            <input className="input" type="number" min={1} max={10} value={settings.maxFixCycles} onChange={(e) => setState((s) => { s.settings = { ...s.settings, maxFixCycles: Math.max(1, Number(e.target.value) || 5) }; })} />
          </Field>
        </div>
      </section>
      <section className="card" data-testid="backend-settings">
        <h3>إعدادات الاتصال بالموديل (Backend)</h3>
        <p className="muted small">بتتطبق على كل الوكلاء. لو موديل التفكير (reasoning) بيبطّأ، زوّد المهلة.</p>
        <div className="form-grid">
          <Field label="مهلة عدم الاستجابة (ثواني)" hint="لو الموديل ما رجّعش أي بيانات المدة دي، الطلب بيتعاد تلقائيًا.">
            <input className="input" type="number" min={20} max={900} value={settings.requestTimeoutSec} data-testid="request-timeout" onChange={(e) => setState((s) => { s.settings = { ...s.settings, requestTimeoutSec: Math.min(900, Math.max(20, Number(e.target.value) || 180)) }; })} />
          </Field>
          <Field label="أقصى عدد توكنز للرد (0 = تلقائي)">
            <input className="input" type="number" min={0} max={200000} value={settings.maxOutputTokens} data-testid="max-tokens" onChange={(e) => setState((s) => { s.settings = { ...s.settings, maxOutputTokens: Math.max(0, Number(e.target.value) || 0) }; })} />
          </Field>
          <Field label="Temperature (0 – 1)">
            <input className="input" type="number" min={0} max={1} step={0.1} value={settings.temperature} onChange={(e) => setState((s) => { s.settings = { ...s.settings, temperature: Math.min(1, Math.max(0, Number(e.target.value))) }; })} />
          </Field>
        </div>
        <Field label="Runner لتشغيل Go / Rust / Java / C++ / PHP… (Piston API)" hint="الكود بيتبعت للخدمة دي لما تضغط تشغيل. ممكن تستضيف Piston بنفسك وتحط رابطه هنا. سيبه فاضي لإيقاف التشغيل البعيد.">
          <input className="input mono" dir="ltr" value={settings.runnerUrl} placeholder="https://…/api/v2/piston" data-testid="runner-url" onChange={(e) => setState((s) => { s.settings = { ...s.settings, runnerUrl: e.target.value.trim() }; })} />
        </Field>
        <p className="muted small">على الأندرويد: لو المزود مالوش CORS، الطلب بيتحول تلقائيًا للشبكة الأصلية (من غير بث لايف للرد).</p>
      </section>
      <section className="card">
        <h3>نسب الفضل</h3>
        <p>UI vocabulary: <a href="https://namethatui.com" target="_blank" rel="noopener noreferrer">NameThatUI</a> — القاموس البصري للواجهات (Fowl Labs). التطبيق بيستخدم مصطلحاته لتسمية كل عنصر واجهة، وبيحفظ نتائج القراءة 7 أيام.</p>
        <p className="muted small">مفاتيح API والتوكن بتتشفر (AES-GCM بمفتاح مرتبط بالجهاز وغير قابل للتصدير). ده مش Android Keystore.</p>
      </section>
    </div>
  );
}
