// End-to-end test: real browser against the built app + the mock LLM (scripts/mock-llm.mjs).
// Usage: npm run build && node scripts/e2e.mjs   (starts both servers itself)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const shots = process.env.SHOTS ?? join(root, 'e2e-shots');
await mkdir(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const mock = spawn('node', [join(root, 'scripts/mock-llm.mjs')], { env: { ...process.env, MOCK_PORT: '8787' }, stdio: 'ignore' });
const web = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://x');
  const f = normalize(join(dist, u.pathname === '/' ? 'index.html' : u.pathname));
  try { res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(await readFile(f)); }
  catch { res.writeHead(404).end(); }
}).listen(5175);
await new Promise((r) => setTimeout(r, 800));

let failed = 0;
const step = async (name, fn) => {
  try { await fn(); console.log('✓', name); } catch (e) { failed++; console.log('✗', name, '\n   ', String(e.message).split('\n')[0]); await page.screenshot({ path: join(shots, 'FAIL-' + name.slice(0, 12).replace(/\W+/g, '_') + '.png') }).catch(() => undefined); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
const T = (id) => page.getByTestId(id);
const shot = (n) => page.screenshot({ path: join(shots, n + '.png') });

await page.goto('http://localhost:5175/');

await step('settings: add provider, list models, test 200', async () => {
  await T('hamburger').click();
  await T('open-settings').click();
  await T('add-provider').click();
  await T('prov-name').fill('Mock');
  await T('prov-url').fill('http://localhost:8787/v1');
  await T('prov-key').fill('sk-test-123');
  await T('list-models').click();
  await T('model-row').first().waitFor();
  if ((await T('model-row').count()) !== 2) throw new Error('expected 2 model rows');
  await T('test-visible').click();
  await page.getByText('200').first().waitFor({ timeout: 10000 });
  await shot('02-models');
  await page.keyboard.press('Escape');
});

await step('settings: roles, observe seconds, github token', async () => {
  for (const r of ['planner', 'coder', 'critic', 'fixer', 'expert']) {
    await T(`role-${r}`).selectOption({ index: 1 });
  }
  await page.getByRole('tab', { name: 'GitHub' }).click();
  await T('gh-token').fill('ghp_faketoken');
  await page.getByRole('tab', { name: 'عن التطبيق' }).click();
  await T('observe-seconds').fill('8');
  await shot('03-settings-about');
  await page.keyboard.press('Escape');
});

await step('new project: live planning + coding', async () => {
  await T('new-project').click();
  await T('project-name').fill('مهامي');
  await T('project-desc').fill('تطبيق ويب بسيط لتتبع المهام بزرارين إضافة ومسح');
  await T('create-project').click();
  await T('workspace').waitFor();
  await T('live-badge').waitFor({ timeout: 20000 });
  await shot('04-live-writing');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid=tree-file]')].length >= 3, null, { timeout: 30000 });
  await T('preview-btn').waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid=activity]'), null, { timeout: 30000 });
  const paths = await T('tree-file').evaluateAll((els) => els.map((e) => e.dataset.path));
  for (const p of ['index.html', 'style.css', 'app.js']) if (!paths.includes(p)) throw new Error('missing ' + p);
});

await step('preview: observer detects flaws, one-pass fix, then review popover', async () => {
  await T('preview-btn').click();
  await T('preview-frame').waitFor();
  await T('review-popover').waitFor({ timeout: 90000 });
  const st = await (await fetch('http://localhost:8787/__state')).json();
  if (!st.fixed) throw new Error('fixer was never called — observer did not flag the broken layout');
  await shot('05-review-popover');
  for (const id of ['continue-watching', 'another-edit', 'thats-it']) if (!(await T(id).isVisible())) throw new Error(id + ' not visible');
  await T('thats-it').click();
  await T('review-popover').waitFor({ state: 'hidden' });
});

await step('plan view is clickable and fullscreen preview toggles', async () => {
  await T('plan-btn').click();
  await T('plan-view').waitFor();
  await T('plan-view').getByText('style.css').first().waitFor();
  await shot('05b-plan');
  await page.keyboard.press('Escape');
  await T('plan-view').waitFor({ state: 'hidden' });
  await T('fullscreen-btn').click();
  await page.waitForSelector('[data-testid=ws-preview].full');
  const box = await T('ws-preview').boundingBox();
  if (!box || box.width < 1200 || box.height < 800) throw new Error('preview is not fullscreen: ' + JSON.stringify(box));
  await shot('05c-fullscreen');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[data-testid=ws-preview]:not(.full)');
});

await step('edit queue: prompt is applied and can be undone', async () => {
  await T('prompt-input').fill('ضيف سطر يقول تم التعديل');
  await T('prompt-send').click();
  await page.waitForSelector('[data-testid=queue-item][data-status=done]', { timeout: 60000 });
  await T('tree-file').filter({ hasText: 'index.html' }).first().click();
  await T('queue-understanding').first().waitFor();
  await page.getByText('✓ اتراجع').first().waitFor();
  await page.getByText('تم التعديل').first().waitFor();
  await shot('06-queue-done');
});

await step('tree shows +/- per file, diff view, save clears it; theme toggles; top-bar plan button', async () => {
  await T('tree-diff').first().waitFor({ timeout: 5000 });
  const txt = (await T('tree-diff').first().innerText()).replace(/\s/g, '');
  if (!/\+\d+/.test(txt)) throw new Error('tree diff badge has no +N: ' + txt);
  await T('tree-file').filter({ hasText: 'index.html' }).first().click();
  await T('diff-view').waitFor({ timeout: 5000 });
  if ((await page.locator('.diff-line.add').count()) < 1) throw new Error('diff shows no added lines');
  await shot('06b-changes');
  await T('diff-toggle').click();
  await T('code').waitFor();
  await page.getByRole('button', { name: /تعديل/ }).first().click();
  await page.getByRole('button', { name: /حفظ/ }).first().click();
  await page.waitForFunction(() => !document.querySelector('[data-testid=tree-file][data-path="index.html"] [data-testid=tree-diff]'), null, { timeout: 5000 });
  await T('plan-btn').click();
  await T('plan-view').waitFor();
  await page.keyboard.press('Escape');
  await T('theme-toggle').click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'light') throw new Error('theme did not switch to light');
  await shot('06c-light');
  await T('theme-toggle').click();
  if ((await page.evaluate(() => document.documentElement.dataset.theme)) !== 'dark') throw new Error('theme did not switch back to dark');
});

await step('publish: blocked below 10/10 (no GitHub calls made)', async () => {
  await page.getByRole('button', { name: 'Close' }).first().click({ timeout: 1000 }).catch(() => undefined);
  await T('publish-btn').click();
  await T('start-publish').click();
  await T('publish-blocked').waitFor({ timeout: 90000 });
  await shot('07-publish-blocked');
  if (await T('details-btn').count()) throw new Error('details button must not exist before a successful publish');
});

await step('mobile layout has no horizontal scroll', async () => {
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 780 });
  await page.waitForTimeout(300);
  const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  await shot('08-mobile');
  if (over) throw new Error('horizontal overflow at 390px');
});

await step('side menus: open/close by button, scrim, Escape and selection', async () => {
  // phone: workspace sidebar is an overlay, closed by default
  if (await T('sidebar').count()) throw new Error('sidebar should start closed on a phone');
  await T('sidebar-toggle').click();
  await T('sidebar').waitFor();
  await page.keyboard.press('Escape');
  await T('sidebar').waitFor({ state: 'hidden' });
  await T('sidebar-toggle').click();
  await T('sidebar-scrim').click({ position: { x: 380, y: 400 } });
  await T('sidebar').waitFor({ state: 'hidden' });
  await T('sidebar-toggle').click();
  await T('tree-file').first().click();
  await T('sidebar').waitFor({ state: 'hidden' });
  // app menu (right drawer)
  await T('hamburger').click();
  await page.getByRole('navigation', { name: /القائمة|Menu/ }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: /القائمة|Menu/ }).waitFor({ state: 'hidden' });
  await shot('09-sidebar-menu');
  // desktop: inline sidebar toggles and stays out of the layout when closed
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.waitForTimeout(200);
  await T('sidebar').waitFor({ state: 'hidden' }).catch(() => undefined);
  if (!(await T('sidebar').count())) await T('sidebar-toggle').click();
  await T('sidebar').waitFor();
  await T('sidebar-toggle').click();
  await T('sidebar').waitFor({ state: 'hidden' });
});

await step('skills: import a GitHub repo as a folder, open its files, see activation check', async () => {
  const blobs = {
    k1: '---\nname: pdf-tools\ndescription: Extract text and tables from PDF documents\n---\nUse pdfplumber for tables.',
    k2: 'Reference: page layout notes', k3: '---\nname: brand-kit\ndescription: Apply brand colours to slides\n---\nUse the palette.',
  };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  const handler = async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(req.url());
    const json = (o, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (u.pathname === '/repos/acme/skills') return json({ default_branch: 'main' });
    if (u.pathname.includes('/git/trees/')) return json({ sha: 'T', truncated: false, tree: [
      { path: 'skills/pdf/SKILL.md', type: 'blob', sha: 'k1', size: 90 },
      { path: 'skills/pdf/reference.md', type: 'blob', sha: 'k2', size: 20 },
      { path: 'skills/brand/SKILL.md', type: 'blob', sha: 'k3', size: 80 },
    ] });
    const m = u.pathname.match(/git\/blobs\/(\w+)$/);
    if (m) return json({ encoding: 'base64', content: Buffer.from(blobs[m[1]]).toString('base64') });
    return json({ message: 'unexpected' }, 500);
  };
  await page.route('https://api.github.com/repos/acme/**', handler);
  await page.setViewportSize({ width: 1280, height: 860 });
  await T('hamburger').click();
  await T('open-settings').click();
  await page.getByRole('tab', { name: /المهارات|Skills/ }).click();
  await T('skills-url').fill('https://github.com/acme/skills');
  await T('skills-import').click();
  await page.getByText('acme/skills').first().waitFor({ timeout: 10000 });
  await page.getByText('pdf-tools').first().waitFor();
  await T('skill-open').filter({ hasText: 'pdf-tools' }).click();
  await T('skill-file').filter({ hasText: 'reference.md' }).click();
  const ref = await T('skill-content').inputValue();
  if (!ref.includes('page layout notes')) throw new Error('skill reference file did not open: ' + ref);
  await T('skill-match-input').fill('أداة بتقرأ ملفات PDF');
  await T('skill-match').waitFor();
  await shot('10-skills');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.unroute('https://api.github.com/repos/acme/**', handler);
});

await step('GitHub import: repos → Start → file tree; native app gets a visual simulation; publish is branch-based', async () => {
  const files = {
    s1: '<manifest package="com.x.notes"/>', s2: 'package com.x.notes\nimport android.os.Bundle\nclass MainActivity', s3: 'plugins { id "com.android.application" }',
  };
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const u = new URL(req.url());
    const json = (o, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (u.pathname === '/user/repos') return json([{ full_name: 'me/notes-android', name: 'notes-android', private: true, default_branch: 'main', description: 'Notes app', language: 'Kotlin', pushed_at: '2026-01-01', html_url: 'https://github.com/me/notes-android', size: 9 }]);
    if (u.pathname.includes('/git/trees/')) return json({ sha: 'T', truncated: false, tree: [
      { path: 'app/src/main/AndroidManifest.xml', type: 'blob', sha: 's1', size: 30 },
      { path: 'app/src/main/java/com/x/notes/MainActivity.kt', type: 'blob', sha: 's2', size: 60 },
      { path: 'build.gradle', type: 'blob', sha: 's3', size: 30 },
    ] });
    const m = u.pathname.match(/git\/blobs\/(\w+)$/);
    if (m) return json({ encoding: 'base64', content: Buffer.from(files[m[1]]).toString('base64') });
    return json({ message: 'unexpected' }, 500);
  });
  await T('hamburger').click();
  await page.getByRole('button', { name: 'مشاريعي' }).first().click();
  await T('new-project').click();
  await T('gh-import').click();
  await T('gh-repo').first().waitFor();
  await T('gh-repo').first().click();
  await T('gh-start').click();
  await T('workspace').waitFor();
  if (!(await T('sidebar').count())) await T('sidebar-toggle').click();
  await T('tree-file').filter({ hasText: 'MainActivity.kt' }).first().waitFor();
  await shot('10-github-import');
  await T('preview-btn').click();
  await T('make-mock').click();
  await page.frameLocator('[data-testid=preview-frame]').getByText('Mock Phone').waitFor({ timeout: 30000 });
  await shot('11-mock-preview');
  await T('publish-btn').click();
  await T('publish-linked').waitFor();
  await T('publish-branch').waitFor();
});

if (pageErrors.length) { failed++; console.log('✗ page errors:\n  ' + pageErrors.join('\n  ')); }
await browser.close();
mock.kill();
web.close();
console.log(failed ? `\n${failed} FAILED` : '\nall e2e steps passed');
process.exit(failed ? 1 : 0);
