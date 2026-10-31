// Real-browser check of the React / Next.js / Python previews. Needs internet (esm.sh, jsdelivr), so it runs in CI.
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = await build({
  stdin: { contents: "import { buildReactPreviewHtml } from './src/lib/react-preview.ts'; import { runPython } from './src/lib/runners.ts'; window.__h = { buildReactPreviewHtml, runPython };", resolveDir: root, loader: 'ts' },
  bundle: true, write: false, format: 'iife', platform: 'browser', target: 'es2022',
});
const harness = out.outputFiles[0].text;
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><meta charset=utf-8><body><div id=host></div>'); }).listen(5176);

const f = (path, content) => ({ path, content });
const REACT = [
  f('package.json', JSON.stringify({ dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1', clsx: '^2.1.1' } })),
  f('index.html', '<!doctype html><html><head><title>t</title></head><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>'),
  f('src/main.jsx', "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App';\nimport './styles.css';\ncreateRoot(document.getElementById('root')).render(<App />);"),
  f('src/App.jsx', "import { useState } from 'react';\nimport clsx from 'clsx';\nimport Title from './components/Title';\nexport default function App() {\n  const [n, setN] = useState(0);\n  return <main className={clsx('box', n > 0 && 'on')}><Title text=\"Hello React\" /><button onClick={() => setN(n + 1)}>Count: {n}</button></main>;\n}"),
  f('src/components/Title.tsx', "export default function Title({ text }: { text: string }) { return <h1>{text}</h1>; }"),
  f('src/styles.css', '.box { padding: 8px } .on { color: red }'),
];
const NEXT = [
  f('package.json', JSON.stringify({ dependencies: { next: '14.2.0', react: '18.3.1', 'react-dom': '18.3.1' } })),
  f('app/globals.css', 'body { font-family: sans-serif }'),
  f('app/layout.tsx', "import './globals.css';\nimport { Inter } from 'next/font/google';\nimport Link from 'next/link';\nconst inter = Inter({ subsets: ['latin'] });\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang=\"en\"><body className={inter.className}><nav><Link href=\"/\">Home</Link> <Link href=\"/about\">About</Link></nav>{children}</body></html>);\n}"),
  f('app/page.tsx', "import Image from 'next/image';\nexport default function Page() { return <section><h1>Home page</h1><Image src=\"/x.png\" alt=\"x\" width={10} height={10} /></section>; }"),
  f('app/about/page.tsx', "'use client';\nimport { usePathname } from 'next/navigation';\nexport default function About() { const p = usePathname(); return <h1>About page {p}</h1>; }"),
];
const PY = [f('main.py', "import json, math\nfrom helper import double\nprint('sum', double(21))\nprint(json.dumps({'pi': round(math.pi, 2)}))\n"), f('helper.py', 'def double(x):\n    return x * 2\n')];

const browser = await chromium.launch();
let failed = 0;
const fail = (name, e, logs) => { failed++; console.log(`::error title=${name}::${String(e.message).split('\n')[0]} | console: ${logs.slice(-6).join(' // ').slice(0, 700)}`); };

async function withPage(name, fn) {
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  const logs = [];
  page.on('console', (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  try {
    await page.goto('http://localhost:5176/');
    await page.addScriptTag({ content: harness });
    await fn(page);
    console.log('✓', name);
  } catch (e) { fail(name, e, logs); }
  await page.close();
}

const mountPreview = (files, kind) => (page) => page.evaluate(({ files, kind }) => {
  const r = window.__h.buildReactPreviewHtml(files, kind, { observer: true });
  const ifr = document.createElement('iframe');
  ifr.id = 'pv'; ifr.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals');
  ifr.style.cssText = 'width:800px;height:600px';
  ifr.srcdoc = r.html;
  document.getElementById('host').appendChild(ifr);
}, { files, kind });

await withPage('react preview: transpile, local modules, npm dep, state', async (page) => {
  await mountPreview(REACT, 'react')(page);
  const fr = page.frameLocator('#pv');
  await fr.getByText('Hello React').waitFor({ timeout: 60000 });
  await fr.getByRole('button', { name: 'Count: 0' }).click();
  await fr.getByRole('button', { name: 'Count: 1' }).waitFor({ timeout: 5000 });
});

await withPage('next preview: layouts, fonts, Link navigation, next/image, usePathname', async (page) => {
  await mountPreview(NEXT, 'next')(page);
  const fr = page.frameLocator('#pv');
  await fr.getByRole('heading', { name: 'Home page' }).waitFor({ timeout: 60000 });
  await fr.getByRole('link', { name: 'About' }).click();
  await fr.getByRole('heading', { name: 'About page /about' }).waitFor({ timeout: 10000 });
});

await withPage('python preview (Pyodide): multi-file project', async (page) => {
  const text = await page.evaluate(({ files }) => new Promise((resolve) => {
    const lines = [];
    const job = window.__h.runPython(files, 'main.py', (t, k) => lines.push(k + ':' + t), 150000);
    job.done.then(() => resolve(lines.join('\n')));
  }), { files: PY });
  if (!/out:sum 42/.test(text) || !/"pi": 3.14/.test(text)) throw new Error('unexpected output: ' + text.slice(0, 300));
});

await browser.close();
server.close();
console.log(failed ? `${failed} preview check(s) FAILED` : 'all preview checks passed');
process.exit(failed ? 1 : 0);
