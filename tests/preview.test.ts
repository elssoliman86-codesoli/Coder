import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectKind } from '../src/lib/preview-kind.ts';
import { BOOTSTRAP, buildReactPreviewHtml, findReactEntry, makeConfig, nextRoutes } from '../src/lib/react-preview.ts';
import { buildPistonRequest, pickRemoteFiles } from '../src/lib/runners.ts';
import { detectProjectType } from '../src/lib/lang.ts';
import { validatePlan } from '../src/agents/plan.ts';
import { workflowsFor } from '../src/github/workflows.ts';
import type { Project, ProjectFile } from '../src/types.ts';

const f = (path: string, content = ''): ProjectFile => ({ path, content });
const pkg = (deps: Record<string, string>) => f('package.json', JSON.stringify({ dependencies: deps }));

test('detectKind: picks the right preview for each kind of project', () => {
  assert.equal(detectKind([f('index.html'), f('app.js')], 'website', 'html').kind, 'html');
  assert.equal(detectKind([pkg({ react: '^18.2.0' }), f('src/App.jsx')], 'webapp', 'javascript').kind, 'react');
  assert.equal(detectKind([f('src/App.tsx')], 'webapp', 'typescript').kind, 'react');
  assert.equal(detectKind([pkg({ next: '14', react: '18' }), f('app/page.tsx')], 'webapp', 'typescript').kind, 'next');
  assert.equal(detectKind([pkg({ vue: '3' }), f('src/App.vue')], 'webapp', 'vue').kind, 'unsupported');
  assert.equal(detectKind([f('main.py')], 'cli', 'python').kind, 'python');
  assert.equal(detectKind([f('cli.js')], 'cli', 'javascript').kind, 'node');
  const go = detectKind([f('main.go')], 'cli', 'go');
  assert.equal(go.kind, 'remote');
  assert.equal(go.remoteLang, 'go');
  assert.equal(detectKind([f('README.md')], 'library', 'text').kind, 'none');
  // a Vite React app keeps index.html but must still be treated as React
  assert.equal(detectKind([f('index.html'), pkg({ react: '18' }), f('src/main.jsx')], 'webapp', 'javascript').kind, 'react');
});

test('nextRoutes: app router with groups, dynamic segments and nested layouts', () => {
  const r = nextRoutes([f('app/layout.tsx'), f('app/page.tsx'), f('app/blog/layout.tsx'), f('app/blog/[slug]/page.tsx'), f('app/(shop)/cart/page.tsx'), f('app/docs/[...rest]/page.tsx'), f('app/not-found.tsx')]);
  assert.deepEqual(r.routes.map((x) => x.route), ['/', '/cart', '/blog/[slug]', '/docs/[...rest]']);
  const blog = r.routes.find((x) => x.route === '/blog/[slug]')!;
  assert.deepEqual(blog.layouts, ['app/layout.tsx', 'app/blog/layout.tsx']);
  assert.equal(r.notFound, 'app/not-found.tsx');
});

test('nextRoutes: pages router ignores api and special files', () => {
  const r = nextRoutes([f('pages/_app.js'), f('pages/index.js'), f('pages/about.js'), f('pages/api/hello.js'), f('pages/posts/[id].js'), f('pages/404.js')]);
  assert.deepEqual(r.routes.map((x) => x.route), ['/', '/about', '/posts/[id]']);
  assert.equal(r.app, 'pages/_app.js');
  assert.equal(r.notFound, 'pages/404.js');
});

test('findReactEntry: from index.html, then conventional names; detects self-mounting entries', () => {
  const a = findReactEntry([f('index.html', '<script type="module" src="/src/main.jsx"></script>'), f('src/main.jsx', 'createRoot(el).render(<App/>)')]);
  assert.deepEqual(a, { entry: 'src/main.jsx', mounted: true });
  const b = findReactEntry([f('src/App.jsx', 'export default function App(){}')]);
  assert.deepEqual(b, { entry: 'src/App.jsx', mounted: false });
  assert.equal(findReactEntry([f('x.txt')]).entry, null);
});

test('makeConfig pins React versions and detects Tailwind; binary files are left out', () => {
  const c = makeConfig([pkg({ react: '^19.0.0', tailwindcss: '^3' }), f('src/App.jsx'), f('logo.png', 'x')], false);
  assert.equal(c.versions.react, '19.0.0');
  assert.ok(c.tailwind);
  assert.ok(!('logo.png' in c.files));
});

test('bootstrap script is valid JavaScript and the generated document wires config, Babel and the observer', () => {
  assert.doesNotThrow(() => new Function(BOOTSTRAP));
  const files = [f('index.html', '<html><head><title>t</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>'), f('src/main.jsx', 'import App from "./App"; createRoot(document.getElementById("root")).render(<App/>)'), f('src/App.jsx', 'export default () => <b>hi</b>')];
  const r = buildReactPreviewHtml(files, 'react', { observer: true });
  assert.equal(r.entry, 'src/main.jsx');
  assert.match(r.html, /babel\.min\.js/);
  assert.match(r.html, /window\.__CFG=/);
  assert.doesNotMatch(r.html, /type="module" src="\/src\/main\.jsx"/, 'original module tag is removed');
  assert.ok(r.html.includes('__obs'), 'observer injected');
  const cfgJson = r.html.match(/window\.__CFG=(\{.*?\});<\/script>/s)![1];
  assert.ok(JSON.parse(cfgJson).files['src/App.jsx']);
});

test('remote runner: entry first, one language only, file names without folders', () => {
  const files = [f('util.go', 'package main'), f('main.go', 'package main\nfunc main(){}'), f('x.py', 'print(1)')];
  const p = pickRemoteFiles(files, 'go')!;
  assert.equal(p.entry, 'main.go');
  const req = buildPistonRequest([f('src/Main.java', 'class Main{ public static void main(String[] a){} }')], 'java')!;
  assert.deepEqual(req.files.map((x) => x.name), ['Main.java']);
  assert.equal(buildPistonRequest([f('a.py')], 'go'), null);
});

test('detectProjectType: frameworks and servers', () => {
  assert.equal(detectProjectType(['package.json', 'src/App.jsx'], [pkg({ react: '18' })]), 'webapp');
  assert.equal(detectProjectType(['package.json', 'server.js'], [pkg({ express: '4' })]), 'backend');
  assert.equal(detectProjectType(['index.html', 'style.css']), 'website');
  assert.equal(detectProjectType(['main.py']), 'cli');
});

test('validatePlan: webapp needs package.json; any language is accepted', () => {
  const base = { type: 'webapp', primaryLanguage: 'typescript', files: [{ path: 'src/App.tsx', purpose: 'x' }], functions: [{ file: 'src/App.tsx', name: 'App', signature: 'App()', description: 'd' }] };
  assert.ok(validatePlan(base).errors.some((e) => e.includes('package.json')));
  const ok = validatePlan({ ...base, files: [...base.files, { path: 'package.json', purpose: 'deps' }] });
  assert.equal(ok.errors.length, 0, ok.errors.join('|'));
  const rust = validatePlan({ type: 'cli', primaryLanguage: 'rust', files: [{ path: 'src/main.rs', purpose: 'x' }], functions: [{ file: 'src/main.rs', name: 'main', signature: 'fn main()', description: 'd' }] });
  assert.equal(rust.plan?.primaryLanguage, 'rust');
});

test('workflows: webapp deploys a built folder to Pages, backend packages', () => {
  const p = (type: string) => ({ name: 'App', type, files: [], primaryLanguage: 'typescript' }) as unknown as Project;
  assert.match(workflowsFor(p('webapp'))[0].content, /npm run build/);
  assert.match(workflowsFor(p('webapp'))[0].content, /deploy-pages/);
  assert.ok(workflowsFor(p('backend'))[0].path.endsWith('package.yml'));
});
