import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GithubClient } from '../src/github/client.ts';
import { diffAgainstImport, gitBlobSha, importRepo } from '../src/github/import.ts';
import { extractJson } from '../src/agents/parse.ts';
import { validatePlan } from '../src/agents/plan.ts';
import { detectKind } from '../src/lib/preview-kind.ts';
import { generateMock } from '../src/agents/pipeline.ts';
import { PROVIDER_PRESETS } from '../src/llm/client.ts';
import { BUILTIN_SKILLS } from '../src/skills/builtin.ts';
import type { Project, ProjectFile } from '../src/types.ts';

const b64 = (s: string | Uint8Array) => Buffer.from(s).toString('base64');
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

test('gitBlobSha matches git hash-object', async () => {
  assert.equal(await gitBlobSha('hello\n'), 'ce013625030ba8dba906f756967f9e9ca394464a');
});

function fakeGithub() {
  const calls: { method: string; url: string; body?: any }[] = [];
  const blobs: Record<string, Uint8Array | string> = { s1: '<h1>hi</h1>\n', s2: 'body{}\n', s3: new Uint8Array([137, 80, 78, 71, 0, 1]), s4: 'x' };
  const f = (async (url: string, init: any = {}) => {
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method ?? 'GET', url: u.pathname + u.search, body });
    if (u.pathname === '/user/repos') return json([{ full_name: 'me/site', name: 'site', private: true, default_branch: 'main', description: 'd', language: 'HTML', pushed_at: '2026-01-01', html_url: 'https://github.com/me/site', size: 5 }]);
    if (u.pathname === '/repos/me/site/git/trees/main') return json({ sha: 'T', truncated: false, tree: [
      { path: 'index.html', type: 'blob', sha: 's1', size: 12 }, { path: 'css/a.css', type: 'blob', sha: 's2', size: 7 },
      { path: 'logo.png', type: 'blob', sha: 's3', size: 6 }, { path: 'node_modules/x.js', type: 'blob', sha: 's4', size: 1 }, { path: 'css', type: 'tree', sha: 'd' },
      { path: 'data.bin', type: 'blob', sha: 's3', size: 6 },
    ] });
    const m = u.pathname.match(/git\/blobs\/(\w+)$/);
    if (m && (init.method ?? 'GET') === 'GET') { const v = blobs[m[1]]; return json({ content: b64(v), encoding: 'base64' }); }
    if (u.pathname.endsWith('/git/ref/heads/feature')) return json({}, 404);
    if (u.pathname.endsWith('/git/ref/heads/main')) return json({ object: { sha: 'H0' } });
    if (u.pathname.endsWith('/git/refs') && init.method === 'POST') return json({}, 201);
    if (u.pathname.endsWith('/git/commits/H0')) return json({ sha: 'H0', tree: { sha: 'T0' } });
    if (u.pathname.endsWith('/git/blobs') && init.method === 'POST') return json({ sha: 'new-' + body.content.slice(0, 4) });
    if (u.pathname.endsWith('/git/trees') && init.method === 'POST') return json({ sha: 'T1' });
    if (u.pathname.endsWith('/git/commits') && init.method === 'POST') return json({ sha: 'C1' });
    if (u.pathname.includes('/git/refs/heads/') && init.method === 'PATCH') return json({});
    return json({ message: 'unexpected ' + u.pathname }, 500);
  }) as unknown as typeof fetch;
  return { gh: new GithubClient('tok', { fetch: f, sleep: async () => undefined }), calls };
}

test('listRepos + importRepo: text files only, binaries and node_modules skipped, shas recorded', async () => {
  const { gh } = fakeGithub();
  const repos = await gh.listRepos();
  assert.equal(repos[0].fullName, 'me/site');
  assert.equal(repos[0].private, true);
  const progress: number[] = [];
  const r = await importRepo(gh, { fullName: 'me/site', htmlUrl: 'https://github.com/me/site' }, 'main', (d) => progress.push(d));
  assert.deepEqual(r.files.map((x) => x.path), ['css/a.css', 'index.html']);
  assert.equal(r.skipped, 3);
  assert.equal(r.link.shas['index.html'], 's1');
  assert.equal(r.link.branch, 'main');
  assert.ok(progress.length >= 2);
});

test('diffAgainstImport: only edited, added and deleted files (blob shas are real git shas)', async () => {
  const files: ProjectFile[] = [{ path: 'a.txt', content: 'one\n' }, { path: 'b.txt', content: 'two\n' }, { path: 'c.txt', content: 'three\n' }];
  const link = { fullName: 'me/x', htmlUrl: '', baseBranch: 'main', branch: 'main', shas: { 'a.txt': await gitBlobSha('one\n'), 'b.txt': await gitBlobSha('two\n'), 'gone.txt': 'zzz' } };
  const edited = [{ path: 'a.txt', content: 'one\n' }, { path: 'b.txt', content: 'TWO\n' }, files[2]];
  const d = await diffAgainstImport(edited, link);
  assert.deepEqual(d.map((x) => [x.path, x.content === null ? null : 'content']).sort(), [['b.txt', 'content'], ['c.txt', 'content'], ['gone.txt', null]]);
});

test('pushChanges: base_tree, deletions as null sha, creates the branch from base, no force', async () => {
  const { gh, calls } = fakeGithub();
  const sha = await gh.pushChanges('me', 'site', 'feature', 'main', [{ path: 'a.txt', content: 'x' }, { path: 'old.txt', content: null }], 'msg');
  assert.equal(sha, 'C1');
  assert.ok(calls.some((c) => c.method === 'POST' && c.url.endsWith('/git/refs') && c.body.ref === 'refs/heads/feature' && c.body.sha === 'H0'), 'branch created from base');
  const tree = calls.find((c) => c.url.endsWith('/git/trees'))!;
  assert.equal(tree.body.base_tree, 'T0');
  assert.equal(tree.body.tree.find((e: any) => e.path === 'old.txt').sha, null);
  const patch = calls.find((c) => c.method === 'PATCH')!;
  assert.equal(patch.body.force, false);
});

test('extractJson: reasoning blocks, trailing commas, chatter; truncated replies get a specific message', () => {
  assert.deepEqual(extractJson('<think>I will use {braces} here</think>\n{"a":1,"b":[1,2,],}'), { a: 1, b: [1, 2] });
  assert.deepEqual(extractJson('Here you go: {"x":{"y":"}"}} thanks'), { x: { y: '}' } });
  assert.throws(() => extractJson('{"files":[{"path":"a"'), /اتقطع/);
  assert.throws(() => extractJson('nothing'), /JSON/);
});

test('validatePlan: __init__.py needs no functions; the rule is soft on retries', () => {
  const plan = { type: 'cli', primaryLanguage: 'python', files: [{ path: 'calc/__init__.py', purpose: 'pkg' }, { path: 'calc/core.py', purpose: 'logic' }, { path: 'main.py', purpose: 'cli' }], functions: [{ file: 'calc/core.py', name: 'add', signature: 'add(a,b)', description: 'd' }] };
  const strict = validatePlan(plan);
  assert.ok(strict.errors.some((e) => e.includes('main.py')) && !strict.errors.some((e) => e.includes('__init__')), strict.errors.join('|'));
  assert.equal(validatePlan(plan, { strict: false }).errors.length, 0);
});

test('detectKind: native apps get an AI simulation instead of a dead end', () => {
  const f = (path: string, content = '') => ({ path, content });
  assert.equal(detectKind([f('app/src/main/AndroidManifest.xml'), f('app/src/main/java/A.kt', 'import android.os.Bundle')], 'apk', 'kotlin').kind, 'mockable');
  assert.equal(detectKind([f('pubspec.yaml'), f('lib/main.dart')], 'apk', 'dart').kind, 'mockable');
  assert.equal(detectKind([f('app.py', 'import tkinter as tk\nroot = tk.Tk()')], 'exe', 'python').kind, 'mockable');
  assert.equal(detectKind([f('MainWindow.xaml'), f('App.csproj', 'WinForms')], 'exe', 'csharp').kind, 'mockable');
  // Capacitor / Electron style projects have an index.html and are previewed for real
  assert.equal(detectKind([f('capacitor.config.json'), f('index.html')], 'apk', 'javascript').kind, 'html');
});

test('generateMock stores an HTML simulation, rejecting non-HTML replies', async () => {
  let project = { id: 'p', name: 'Notes', description: 'app', type: 'apk', primaryLanguage: 'kotlin', files: [{ path: 'a.kt', content: 'x' }] } as unknown as Project;
  const mk = (reply: string) => ({
    signal: new AbortController().signal, skills: BUILTIN_SKILLS, getProject: () => project,
    patch: (fn: (p: Project) => void) => { project = structuredClone(project); fn(project); }, commitFile: () => {}, draft: () => {}, log: () => {},
    chat: async () => reply,
  });
  await generateMock(mk('```html\n<!doctype html><html><body>mock</body></html>\n```') as any);
  assert.match(project.mock!.html, /^<!doctype html>/);
  await assert.rejects(() => generateMock(mk('sorry I cannot') as any), /HTML/);
});

test('NVIDIA NIM preset exists', () => {
  assert.equal(PROVIDER_PRESETS.find((p) => p.id === 'nvidia')?.baseUrl, 'https://integrate.api.nvidia.com/v1');
});

test('detectKind: Python GUI apps declared only in requirements.txt (customtkinter) are simulated, not run', () => {
  const f = (path: string, content = '') => ({ path, content });
  const k = detectKind([f('calculator/main.py', 'import customtkinter as ctk'), f('requirements.txt', 'customtkinter>=5.2.0\n')], 'exe', 'python');
  assert.equal(k.kind, 'mockable');
  assert.equal(detectKind([f('requirements.txt', 'requests\n'), f('main.py', 'print(1)')], 'cli', 'python').kind, 'python');
});
