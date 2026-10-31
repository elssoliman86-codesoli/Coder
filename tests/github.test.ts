import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GithubClient } from '../src/github/client.ts';
import { PublishBlocked, nextVersion, publishProject, releaseFiles } from '../src/github/publish.ts';
import { appId, workflowsFor } from '../src/github/workflows.ts';
import { BUILTIN_SKILLS } from '../src/skills/builtin.ts';
import type { RunCtx } from '../src/agents/pipeline.ts';
import type { Project } from '../src/types.ts';

function project(over: Partial<Project> = {}): Project {
  return {
    id: 'p', name: 'My Shop', description: 'shop', type: 'website', primaryLanguage: 'html', status: 'ready', style: 'Minimalism', queue: [], createdAt: 0, updatedAt: 0, reviewCycles: 1,
    files: [{ path: 'index.html', content: '<!doctype html><title>x</title><p>hi</p>' }],
    ...over,
  };
}

function makeCtx(p: Project, score: number) {
  let project = p;
  const logs: string[] = [];
  const ctx: RunCtx = {
    signal: new AbortController().signal,
    skills: BUILTIN_SKILLS,
    getProject: () => project,
    patch: (fn) => { project = structuredClone(project); fn(project); },
    commitFile: (path, content) => { project = structuredClone(project); const f = project.files.find((x) => x.path === path); if (f) f.content = content; else project.files.push({ path, content }); },
    draft: () => {},
    log: (m) => logs.push(m),
    chat: async (_role, messages) => ((messages[0].content as string).includes('scoring a project')
      ? JSON.stringify({ score, criteria: {}, blockers: score === 10 ? [] : ['needs work'], summary: 'summary' })
      : 'NO_CHANGES'),
  };
  return { ctx, get: () => project, logs };
}

interface Call { method: string; path: string; body?: any }

function fakeGithub(opts: { runConclusions?: (string | null)[]; exists?: string[] } = {}) {
  const calls: Call[] = [];
  let runPolls = 0;
  const conclusions = opts.runConclusions ?? ['success'];
  const json = (data: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } });
  const f = (async (url: string, init: any = {}) => {
    const path = url.replace('https://api.github.com', '');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    if (path === '/user') return json({ login: 'octo' }, 200, { 'x-oauth-scopes': 'repo, workflow' });
    if (method === 'GET' && /^\/repos\/octo\/([^/]+)$/.test(path)) return json({}, opts.exists?.includes(path.split('/')[3]) ? 200 : 404);
    if (path === '/user/repos') return json({ full_name: `octo/${body.name}`, html_url: `https://github.com/octo/${body.name}`, default_branch: 'main', owner: { login: 'octo' } }, 201);
    if (path.endsWith('/pages') && method === 'POST') return json({}, 201);
    if (path.endsWith('/pages') && method === 'GET') return json({ html_url: 'https://octo.github.io/my-shop/' });
    if (path.includes('/git/ref/heads/')) return json({ object: { sha: 'parent1' } });
    if (path.includes('/git/commits/parent1')) return json({ sha: 'parent1', tree: { sha: 't0' } });
    if (path.endsWith('/git/blobs')) return json({ sha: 'blob' + calls.length }, 201);
    if (path.endsWith('/git/trees')) return json({ sha: 'tree1' }, 201);
    if (path.endsWith('/git/commits') && method === 'POST') return json({ sha: 'commit1' }, 201);
    if (path.includes('/git/refs/heads/')) return json({});
    if (path.includes('/actions/runs?head_sha=')) {
      const c = conclusions[Math.min(runPolls++, conclusions.length - 1)];
      return json({ workflow_runs: [{ id: 7, status: c === null ? 'in_progress' : 'completed', conclusion: c, html_url: 'https://github.com/octo/r/actions/runs/7' }] });
    }
    if (path.includes('/rerun-failed-jobs')) return json({}, 201);
    if (path.endsWith('/releases/latest')) return json({ html_url: 'https://github.com/octo/r/releases/1', assets: [{ name: 'a.apk', browser_download_url: 'https://github.com/octo/r/releases/download/b1/a.apk' }] });
    if (method === 'PATCH' || method === 'PUT') return json({});
    return json({ message: 'unexpected ' + method + ' ' + path }, 500);
  }) as unknown as typeof fetch;
  return { gh: new GithubClient('tok', { fetch: f, sleep: async () => {} }), calls };
}

test('a committed .env file is a critical blocker even if the model says 10/10', async () => {
  const { ctx } = makeCtx(project({ files: [{ path: 'index.html', content: 'x' }, { path: '.env', content: 'SECRET=1' }] }), 10);
  const { gh, calls } = fakeGithub();
  await assert.rejects(publishProject(ctx, gh, { repoName: 'x', isPrivate: true }), (e: any) => e instanceof PublishBlocked && e.report.score <= 3);
  assert.equal(calls.length, 0);
});

test('publish is BLOCKED below 10/10 and makes no GitHub write call', async () => {
  const { ctx } = makeCtx(project(), 8);
  const { gh, calls } = fakeGithub();
  await assert.rejects(publishProject(ctx, gh, { repoName: 'my-shop', isPrivate: false }), (e: any) => e instanceof PublishBlocked && e.report.score === 8);
  assert.equal(calls.length, 0);
});

test('website publish: repo → Pages → single commit → build → details', async () => {
  const { ctx, get } = makeCtx(project(), 10);
  const { gh, calls } = fakeGithub();
  const info = await publishProject(ctx, gh, { repoName: 'My Shop', isPrivate: false });
  const seq = calls.map((c) => `${c.method} ${c.path.split('?')[0]}`);
  const idx = (re: RegExp) => seq.findIndex((s) => re.test(s));
  assert.ok(idx(/POST \/user\/repos/) > idx(/GET \/user$/));
  assert.ok(idx(/POST .*\/pages$/) > idx(/POST \/user\/repos/), 'Pages is enabled right after the repo exists');
  assert.ok(idx(/POST .*\/git\/blobs/) > idx(/POST .*\/pages$/));
  assert.ok(idx(/PATCH .*\/git\/refs\/heads\/main/) > idx(/POST .*\/git\/commits$/));
  assert.ok(idx(/GET .*\/actions\/runs/) > idx(/PATCH .*\/git\/refs/));
  assert.equal(calls.find((c) => c.path === '/user/repos')!.body.name, 'my-shop');
  assert.equal(info.pagesUrl, 'https://octo.github.io/my-shop/');
  assert.equal(info.repoFullName, 'octo/my-shop');
  assert.equal(info.version, 'v1');
  assert.equal(info.score, 10);
  assert.equal(get().publish!.repoUrl, 'https://github.com/octo/my-shop');
  // pushed tree: no secrets, README/LICENSE/.gitignore/workflow added
  const tree = calls.find((c) => c.path.endsWith('/git/trees'))!.body.tree.map((t: any) => t.path);
  assert.ok(!tree.includes('.env'));
  for (const f of ['README.md', 'LICENSE', '.gitignore', '.github/workflows/pages.yml', 'index.html']) assert.ok(tree.includes(f), f);
  // topics + description set
  assert.ok(calls.some((c) => c.method === 'PUT' && c.path.endsWith('/topics')));
});

test('a failed workflow is re-run once, then reported with the run link', async () => {
  const { ctx } = makeCtx(project({ type: 'apk' }), 10);
  const { gh, calls } = fakeGithub({ runConclusions: ['failure', 'failure'] });
  await assert.rejects(publishProject(ctx, gh, { repoName: 'app', isPrivate: true }), (e: any) => /فشل بناء/.test(e.message) && e.partial.runUrl.includes('/actions/runs/7'));
  assert.equal(calls.filter((c) => c.path.includes('/rerun-failed-jobs')).length, 1);
});

test('apk publish returns the release asset; republish reuses the repo and bumps the version', async () => {
  const { ctx } = makeCtx(project({ type: 'apk', publish: { repoUrl: 'https://github.com/octo/app', repoFullName: 'octo/app', version: 'v2', score: 10, report: '', publishedAt: 0 } }), 10);
  const { gh, calls } = fakeGithub();
  const info = await publishProject(ctx, gh, { repoName: 'ignored', isPrivate: true });
  assert.equal(info.version, 'v3');
  assert.equal(info.repoFullName, 'octo/app');
  assert.ok(!calls.some((c) => c.path === '/user/repos'), 'no new repo on republish');
  assert.match(info.artifactUrl!, /\.apk$/);
});

test('name collisions pick a free repo name', async () => {
  const { ctx } = makeCtx(project(), 10);
  const { gh, calls } = fakeGithub({ exists: ['my-shop'] });
  const info = await publishProject(ctx, gh, { repoName: 'my-shop', isPrivate: false });
  assert.equal(info.repoFullName, 'octo/my-shop-2');
  assert.equal(calls.find((c) => c.path === '/user/repos')!.body.name, 'my-shop-2');
});

test('workflows per project type', () => {
  const p = project();
  assert.match(workflowsFor(p)[0].content, /deploy-pages/);
  const apk = workflowsFor(project({ type: 'apk', name: 'Notes App' }))[0];
  assert.match(apk.content, /assembleDebug/);
  assert.match(apk.content, /"appId": "com\.onebyte\.notesapp"/);
  assert.match(workflowsFor(project({ type: 'exe', primaryLanguage: 'python', files: [{ path: 'main.py', content: 'x' }] }))[0].content, /pyinstaller/);
  assert.equal(workflowsFor(project({ type: 'library' }))[0].triggersBuild, false);
  assert.deepEqual(workflowsFor(project({ files: [{ path: '.github/workflows/x.yml', content: '' }] })), [], 'never overwrite an existing workflow');
  assert.equal(appId('123 App'), 'com.onebyte.app123app');
});

test('helpers', () => {
  assert.equal(nextVersion(undefined), 'v1');
  assert.equal(nextVersion('v9'), 'v10');
  const withSecret = project({ files: [{ path: 'index.html', content: 'x' }, { path: '.env', content: 'S=1' }, { path: '.env.example', content: 'S=' }] });
  const paths = releaseFiles(withSecret).map((f) => f.path);
  assert.ok(!paths.includes('.env') && paths.includes('.env.example'));
});

test('GithubClient surfaces permission hints on 403/404', async () => {
  const gh = new GithubClient('t', { fetch: (async () => new Response('{"message":"Resource not accessible"}', { status: 403 })) as any });
  await assert.rejects(gh.user(), /403.*Resource not accessible.*صلاحيات/);
});
