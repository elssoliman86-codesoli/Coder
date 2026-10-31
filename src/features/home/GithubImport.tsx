import { useEffect, useMemo, useState } from 'react';
import { Field, Icon, Modal, Spinner, toast } from '../../components/ui';
import { useApp, setState } from '../../storage/store';
import { GithubClient, type RepoSummary } from '../../github/client';
import { importRepo } from '../../github/import';
import { detectProjectType, primaryLanguage } from '../../lib/lang';
import { errMsg, uid } from '../../lib/util';
import type { Project } from '../../types';

/** "Call GitHub": my repositories → pick one → Start → the project opens with its full file tree, ready to edit. */
export function GithubImportModal({ onClose, onImported }: { onClose: () => void; onImported: (id: string) => void }) {
  const token = useApp((s) => s.github.token);
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<RepoSummary | null>(null);
  const [branch, setBranch] = useState('');
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!token) return;
    let dead = false;
    new GithubClient(token).listRepos().then((r) => { if (!dead) setRepos(r); }, (e) => { if (!dead) setError(errMsg(e)); });
    return () => { dead = true; };
  }, [token]);

  const shown = useMemo(() => (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(q.trim().toLowerCase())), [repos, q]);

  async function start() {
    if (!sel) return;
    setBusy({ done: 0, total: 0 });
    setError('');
    try {
      const r = await importRepo(new GithubClient(token), { fullName: sel.fullName, htmlUrl: sel.htmlUrl }, branch.trim() || sel.defaultBranch, (done, total) => setBusy({ done, total }));
      if (r.files.length === 0) throw new Error('الريبو مفيهوش ملفات نصية قابلة للتعديل');
      const id = uid('p');
      const paths = r.files.map((f) => f.path);
      const now = Date.now();
      const project: Project = {
        id, name: sel.name, description: sel.description || `مشروع مستورد من GitHub: ${sel.fullName}`, type: detectProjectType(paths, r.files),
        primaryLanguage: primaryLanguage(paths), files: r.files, status: 'ready', style: 'Minimalism', queue: [],
        importedFrom: sel.fullName, github: r.link, createdAt: now, updatedAt: now, reviewCycles: 0,
      };
      setState((s) => { s.projects = { ...s.projects, [id]: project }; });
      if (r.skipped) toast(`تم تخطي ${r.skipped} ملف (ثنائي/كبير) — مش هيتلمسوا عند الرفع`, 'info');
      if (r.truncated) toast('الريبو كبير: GitHub رجّع قايمة ملفات مقطوعة', 'error');
      onImported(id);
    } catch (e) {
      setError(errMsg(e));
      setBusy(null);
    }
  }

  return (
    <Modal title="استدعاء مشروع من GitHub" onClose={busy ? () => {} : onClose} wide
      footer={<><button className="btn" onClick={onClose} disabled={!!busy}>إلغاء</button><button className="btn primary" onClick={start} disabled={!sel || !!busy} data-testid="gh-start">{busy ? <Spinner /> : null} بدء</button></>}>
      {!token ? <p className="field-error" role="alert">محتاج توكن GitHub — الإعدادات ← GitHub.</p> : (
        <div className="stack">
          <Field label="مشاريعي">
            <input className="input" placeholder="ابحث عن ريبو…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="gh-search" />
          </Field>
          {error && <p className="field-error" role="alert">{error}</p>}
          {!repos && !error && <p className="muted"><Spinner /> بيجيب مشاريعك…</p>}
          {repos && (
            <ul className="repo-list" data-testid="gh-repos" role="listbox" aria-label="repos">
              {shown.map((r) => (
                <li key={r.fullName}>
                  <button role="option" aria-selected={sel?.fullName === r.fullName} className={sel?.fullName === r.fullName ? 'repo on' : 'repo'} onClick={() => { setSel(r); setBranch(r.defaultBranch); }} data-testid="gh-repo">
                    <Icon name="github" size={16} />
                    <span className="repo-name mono" dir="ltr">{r.fullName}</span>
                    {r.private && <span className="badge">خاص</span>}
                    {r.language && <span className="badge">{r.language}</span>}
                    <span className="muted small repo-desc">{r.description}</span>
                  </button>
                </li>
              ))}
              {shown.length === 0 && <li className="muted">مفيش نتائج</li>}
            </ul>
          )}
          {sel && (
            <Field label="الفرع" hint="التعديلات بتتجمع هنا، وعند الرفع بتختار تنزل على أنهي فرع.">
              <input className="input mono" dir="ltr" value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="gh-branch" />
            </Field>
          )}
          {busy && <p className="muted" role="status" data-testid="gh-progress">بيحمّل الملفات… {busy.done}/{busy.total || '…'}</p>}
        </div>
      )}
    </Modal>
  );
}
