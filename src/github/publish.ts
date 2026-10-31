import type { Project, ProjectFile, PublishInfo } from '../types';
import { runExpert, type ExpertReport, type RunCtx } from '../agents/pipeline';
import { GithubClient, type RunInfo } from './client';
import { GITIGNORE, MIT_LICENSE, fallbackReadme, workflowsFor } from './workflows';
import { slugify } from '../lib/util';
import { throwIfAborted } from '../lib/util';

export class PublishBlocked extends Error {
  constructor(public report: ExpertReport) {
    super(`النشر متوقف: التقييم ${report.score}/10 — لازم 10/10`);
  }
}

export class PublishFailed extends Error {
  constructor(message: string, public partial?: { repoUrl: string; runUrl?: string }) {
    super(message);
  }
}

export interface PublishOptions {
  repoName: string;
  isPrivate: boolean;
  step?: (label: string) => void;
}

const TOPICS: Record<string, string[]> = {
  website: ['website', 'github-pages'],
  webapp: ['webapp', 'github-pages'],
  backend: ['backend', 'api'],
  apk: ['android', 'apk', 'capacitor'],
  cli: ['cli'],
  exe: ['desktop', 'windows'],
  library: ['library'],
};

export function nextVersion(prev?: string): string {
  const n = Number(prev?.match(/^v(\d+)$/)?.[1] ?? 0);
  return `v${n + 1}`;
}

/** Files that go to GitHub: the project + the repository essentials + the build workflow. */
export function releaseFiles(p: Project, readme?: string): ProjectFile[] {
  const files = p.files.filter((f) => !/\.(env|pem|key|jks|keystore)$/i.test(f.path) || /\.example$/i.test(f.path));
  const has = (re: RegExp) => files.some((f) => re.test(f.path));
  const out = [...files];
  if (!has(/^README\.md$/i)) out.push({ path: 'README.md', content: readme ?? fallbackReadme(p) });
  if (!has(/^LICENSE(\.md|\.txt)?$/i)) out.push({ path: 'LICENSE', content: MIT_LICENSE('Project authors', new Date().getFullYear()) });
  if (!has(/^\.gitignore$/)) out.push({ path: '.gitignore', content: GITIGNORE });
  for (const w of workflowsFor({ ...p, files: out })) out.push({ path: w.path, content: w.content });
  return out;
}

export async function publishProject(ctx: RunCtx, gh: GithubClient, opts: PublishOptions): Promise<PublishInfo> {
  const step = opts.step ?? (() => {});
  const log = ctx.log;

  step('expert');
  const report = await runExpert(ctx);
  if (!report.passed) throw new PublishBlocked(report);

  throwIfAborted(ctx.signal);
  const p = ctx.getProject();
  const readme = p.files.find((f) => /^README\.md$/i.test(f.path))?.content;
  const files = releaseFiles(p, readme);
  const triggersBuild = workflowsFor({ ...p, files: files.filter((f) => !f.path.startsWith('.github/')) }).some((w) => w.triggersBuild) || files.some((f) => f.path.startsWith('.github/workflows/') && p.type !== 'library');

  step('github-user');
  const me = await gh.user();
  let owner = me.login;
  let repoName = slugify(opts.repoName);
  let repoUrl: string;
  let branch = 'main';
  const prev = p.publish;

  if (prev) {
    [owner, repoName] = prev.repoFullName.split('/');
    repoUrl = prev.repoUrl;
    log(`إعادة نشر على نفس الريبو ${prev.repoFullName}`);
  } else {
    step('create-repo');
    let created: Awaited<ReturnType<GithubClient['createRepo']>> | null = null;
    const base = repoName;
    for (let i = 0; i < 5 && !created; i++) {
      const candidate = i === 0 ? base : `${base}-${i + 1}`;
      if (await gh.repoExists(owner, candidate)) continue;
      created = await gh.createRepo(candidate, { private: opts.isPrivate, description: p.plan?.summary || p.description });
      repoName = candidate;
    }
    if (!created) throw new PublishFailed('اسم الريبو مستخدم بالفعل — اختار اسم تاني');
    owner = created.owner;
    repoUrl = created.html_url;
    branch = created.default_branch;
    log(`تم إنشاء الريبو ${created.full_name}`, 'ok');
  }

  if (p.type === 'website' || p.type === 'webapp') {
    step('pages');
    try {
      const r = await gh.enablePages(owner, repoName);
      log(r === 'enabled' ? 'تم تفعيل GitHub Pages' : 'GitHub Pages مفعّل بالفعل', 'ok');
    } catch (e) {
      log(`تعذر تفعيل GitHub Pages: ${(e as Error).message} (الريبو الخاص يحتاج خطة تدعم Pages)`, 'warn');
    }
  }

  throwIfAborted(ctx.signal);
  step('push');
  const version = nextVersion(prev?.version);
  const sha = await gh.pushFiles(owner, repoName, branch, files, `Publish ${version} — ${p.name}`);
  log(`تم رفع ${files.length} ملف (commit ${sha.slice(0, 7)})`, 'ok');

  let runs: RunInfo[] = [];
  if (triggersBuild) {
    step('build');
    runs = await gh.waitForRuns(owner, repoName, sha);
    const failed = runs.filter((r) => r.conclusion && r.conclusion !== 'success');
    if (failed.length) {
      log('الـ workflow فشل — إعادة المحاولة مرة واحدة…', 'warn');
      await gh.rerunFailed(owner, repoName, failed[0].id);
      runs = await gh.waitForRuns(owner, repoName, sha);
    }
    const bad = runs.find((r) => r.conclusion && r.conclusion !== 'success');
    if (bad) throw new PublishFailed(`فشل بناء المشروع على GitHub Actions (${bad.conclusion})`, { repoUrl, runUrl: bad.url });
    log('اكتمل البناء على GitHub Actions', 'ok');
  }

  step('details');
  let pagesUrl: string | undefined;
  let artifactUrl: string | undefined;
  if (p.type === 'website' || p.type === 'webapp') pagesUrl = (await gh.pagesUrl(owner, repoName).catch(() => null)) ?? `https://${owner}.github.io/${repoName}/`;
  if (p.type === 'apk' || p.type === 'exe' || p.type === 'cli' || p.type === 'backend') {
    const rel = await gh.latestRelease(owner, repoName).catch(() => null);
    artifactUrl = rel?.assets[0]?.url ?? rel?.url;
  }
  await gh.setDescription(owner, repoName, p.plan?.summary || p.description, pagesUrl).catch(() => {});
  await gh.setTopics(owner, repoName, [...(TOPICS[p.type] ?? []), '2onebyte-coder']).catch(() => {});

  const info: PublishInfo = {
    repoUrl,
    repoFullName: `${owner}/${repoName}`,
    pagesUrl,
    artifactUrl,
    version,
    score: report.score,
    report: report.summary,
    publishedAt: Date.now(),
  };
  ctx.patch((x) => { x.publish = info; });
  return info;
}
