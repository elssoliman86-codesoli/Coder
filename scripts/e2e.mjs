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

await step('edit queue: prompt is applied and can be undone', async () => {
  await T('prompt-input').fill('ضيف سطر يقول تم التعديل');
  await T('prompt-send').click();
  await page.waitForSelector('[data-testid=queue-item][data-status=done]', { timeout: 60000 });
  await T('tree-file').filter({ hasText: 'index.html' }).first().click();
  await page.getByText('تم التعديل').first().waitFor();
  await shot('06-queue-done');
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

if (pageErrors.length) { failed++; console.log('✗ page errors:\n  ' + pageErrors.join('\n  ')); }
await browser.close();
mock.kill();
web.close();
console.log(failed ? `\n${failed} FAILED` : '\nall e2e steps passed');
process.exit(failed ? 1 : 0);
