import { useState } from 'react';
import type { Project } from '../../types';
import { useApp, setState, acceptChanges } from '../../storage/store';
import { useT } from '../../i18n';
import { Field, Icon, Modal, ProgressRing, toast } from '../../components/ui';
import { modelOptions } from '../settings/Settings';
import { GithubClient } from '../../github/client';
import { PublishBlocked, PublishFailed, publishProject } from '../../github/publish';
import { runJob, useRuntime } from '../../runtime';
import { slugify } from '../../lib/util';
import type { ExpertReport } from '../../agents/pipeline';

const STEPS: [string, string][] = [
  ['expert', 'الخبير: مراجعة وتنظيف وفحص أمني وتقييم'],
  ['github-user', 'التحقق من حساب GitHub'],
  ['create-repo', 'إنشاء الريبو'],
  ['pages', 'تفعيل GitHub Pages'],
  ['push', 'رفع الملفات (commit واحد)'],
  ['build', 'البناء على GitHub Actions'],
  ['details', 'تجهيز التفاصيل'],
];

export function PublishModal({ project, onClose, onOpenSettings }: { project: Project; onClose: () => void; onOpenSettings: () => void }) {
  const t = useT();
  const providers = useApp((s) => s.providers);
  const roles = useApp((s) => s.roles);
  const gh = useApp((s) => s.github);
  const logs = useRuntime((r) => r.logs[project.id] ?? []);
  const opts = modelOptions(providers);
  const current = roles.expert ? `${roles.expert.providerId}::${roles.expert.modelId}` : '';
  const [model, setModel] = useState(current || opts[0]?.value || '');
  const [repo, setRepo] = useState(slugify(project.name));
  const [priv, setPriv] = useState(project.type !== 'website');
  const [step, setStep] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<ExpertReport | null>(null);
  const [error, setError] = useState<{ message: string; runUrl?: string; repoUrl?: string } | null>(null);
  const [done, setDone] = useState(false);

  const linked = project.github;
  const [branch, setBranch] = useState(linked ? (linked.branch === linked.baseBranch ? '2onebyte-edits' : linked.branch) : '');
  const needsToken = !gh.token;
  const ready = !needsToken && (linked ? !!branch.trim() : !!model);

  async function start() {
    if (!linked) {
      const [providerId, ...rest] = model.split('::');
      setState((s) => { s.roles = { ...s.roles, expert: { providerId, modelId: rest.join('::') } }; });
    }
    setBlocked(null);
    setError(null);
    setStep(linked ? 'github-user' : 'expert');
    const info = await runJob(project.id, 'publish', async (ctx) => {
      try {
        return await publishProject(ctx, new GithubClient(gh.token), { repoName: repo, isPrivate: priv, branch: branch.trim(), step: setStep });
      } catch (e) {
        if (e instanceof PublishBlocked) setBlocked(e.report);
        else if (e instanceof PublishFailed) setError({ message: e.message, runUrl: e.partial?.runUrl, repoUrl: e.partial?.repoUrl });
        else throw e;
        return undefined;
      }
    });
    setStep(null);
    if (info) { acceptChanges(project.id); setDone(true); toast('تم النشر بنجاح', 'ok'); }
  }

  const idx = step ? STEPS.findIndex(([k]) => k === step) : -1;

  return (
    <Modal title={`${t('publish')} — ${t('handToExpert')}`} onClose={step ? () => {} : onClose} wide
      footer={!step && !done ? (<><button className="btn" onClick={onClose}>{t('cancel')}</button><button className="btn primary" disabled={!ready} onClick={start} data-testid="start-publish">{t('handToExpert')}</button></>) : done ? <button className="btn primary" onClick={onClose}>{t('close')}</button> : undefined}>
      {needsToken && <p className="field-error" role="alert">محتاج توكن GitHub. <button className="link" onClick={() => { onClose(); onOpenSettings(); }}>افتح الإعدادات</button></p>}
      {!linked && opts.length === 0 && <p className="field-error" role="alert">{t('noModel')}</p>}
      {!step && !done && linked && (
        <div className="stack" data-testid="publish-linked">
          <p>الريبو: <a href={linked.htmlUrl} target="_blank" rel="noopener noreferrer" className="mono" dir="ltr">{linked.fullName}</a></p>
          <Field label="ارفع التعديلات على فرع" hint={`الأساس: ${linked.baseBranch}. لو الفرع مش موجود هيتعمل منه. اكتب ${linked.baseBranch} للرفع المباشر عليه.`}>
            <input className="input mono" dir="ltr" value={branch} onChange={(e) => setBranch(e.target.value)} data-testid="publish-branch" />
          </Field>
          <p className="muted small">بيترفع commit واحد فيه الملفات اللي اتغيّرت بس. الصور والملفات الثنائية اللي ما اتستوردتش مبتتلمسش. الفحص الأمني بيمنع رفع أي مفتاح مسرّب.</p>
        </div>
      )}
      {!step && !done && !linked && (
        <div className="stack">
          <Field label={t('pickInspector')} hint="الخبير بيفحص الكود ويصلحه ويقيّمه. يفضل موديل غير موديل الكتابة.">
            <select className="input mono" dir="ltr" value={model} onChange={(e) => setModel(e.target.value)} data-testid="inspector-model">
              {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="اسم الريبو"><input className="input mono" dir="ltr" value={repo} onChange={(e) => setRepo(slugify(e.target.value))} disabled={!!project.publish} /></Field>
            <Field label="الظهور" hint={project.type === 'website' ? 'GitHub Pages على الخطط المجانية بيحتاج ريبو عام.' : undefined}>
              <select className="input" value={priv ? 'private' : 'public'} onChange={(e) => setPriv(e.target.value === 'private')} disabled={!!project.publish}>
                <option value="private">خاص</option><option value="public">عام</option>
              </select>
            </Field>
          </div>
          <p className="muted small">الخبير هيعمل: code review وتنظيف، فحص ثغرات، README. النشر بيكمل بس لو التقييم 10/10. بعدها بيتبني حسب النوع: {(project.type === 'website' || project.type === 'webapp') ? 'استضافة GitHub Pages' : project.type === 'apk' ? 'APK في Release' : project.type === 'exe' ? 'ملف exe في Release' : 'حزمة في Release'}.</p>
        </div>
      )}
      {step && (
        <ol className="steps" data-testid="publish-steps">
          {STEPS.map(([k, label], i) => (
            <li key={k} className={i < idx ? 'done' : i === idx ? 'now' : ''}>{i < idx ? <Icon name="check" size={16} /> : i === idx ? <ProgressRing value={0.3} size={18} /> : <span className="num-dot">{i + 1}</span>} {label}</li>
          ))}
        </ol>
      )}
      {(step || blocked || error) && <pre className="log mono small" dir="auto">{logs.slice(-8).map((l) => l.msg).join('\n')}</pre>}
      {blocked && (
        <div className="callout callout-error" role="alert" data-testid="publish-blocked">
          <strong>النشر متوقف — التقييم {blocked.score}/10 (المطلوب 10/10)</strong>
          <ul>{blocked.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul>
          <p className="small">اكتب التعديلات المطلوبة في شريط الكتابة أو أعد المحاولة ليشتغل الخبير جولة جديدة.</p>
        </div>
      )}
      {error && (
        <div className="callout callout-error" role="alert">
          <strong>{error.message}</strong>
          {error.runUrl && <p><a href={error.runUrl} target="_blank" rel="noopener noreferrer">سجل البناء</a></p>}
          {error.repoUrl && <p><a href={error.repoUrl} target="_blank" rel="noopener noreferrer">الريبو</a></p>}
        </div>
      )}
      {done && <p className="callout callout-ok">تم النشر. زرار «التفاصيل» ظاهر الآن في الشريط الجانبي.</p>}
    </Modal>
  );
}

export function DetailsModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const p = project.publish;
  if (!p) return null;
  const copy = (text: string) => { void navigator.clipboard?.writeText(text).then(() => toast('تم النسخ', 'ok')); };
  const row = (label: string, url?: string) => url ? (
    <div className="detail-row"><span>{label}</span><a className="mono" dir="ltr" href={url} target="_blank" rel="noopener noreferrer">{url}</a><button className="icon-btn" aria-label="copy" onClick={() => copy(url)}><Icon name="copy" size={16} /></button></div>
  ) : null;
  return (
    <Modal title={`التفاصيل — ${project.name}`} onClose={onClose} wide>
      <div className="stack" data-testid="details">
        {row('رابط الموقع', p.pagesUrl)}
        {row('رابط الريبو', p.repoUrl)}
        {row(project.type === 'apk' ? 'ملف التثبيت (APK)' : 'ملف البناء', p.artifactUrl)}
        <div className="detail-row"><span>الإصدار</span><b>{p.version}</b></div>
        <div className="detail-row"><span>التقييم</span><b>{p.score}/10</b></div>
        {p.report && <p className="muted">{p.report}</p>}
        <p className="muted small">آخر نشر: {new Date(p.publishedAt).toLocaleString()}</p>
      </div>
    </Modal>
  );
}
