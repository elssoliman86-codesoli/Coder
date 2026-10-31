import type { ProjectFile } from '../types';
import { injectObserver } from '../agents/observer';

function dirOf(p: string) { return p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : ''; }

export function resolvePath(from: string, ref: string): string {
  const clean = ref.split('#')[0].split('?')[0];
  const parts = (clean.startsWith('/') ? clean.slice(1) : dirOf(from) + clean).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') out.pop(); else out.push(p);
  }
  return out.join('/');
}

const isLocal = (u: string) => !!u && !/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);

export function findEntry(files: ProjectFile[]): string | null {
  return files.find((f) => f.path === 'index.html')?.path ?? files.find((f) => f.path.endsWith('/index.html'))?.path ?? files.find((f) => f.path.endsWith('.html'))?.path ?? null;
}

const MIME: Record<string, string> = { svg: 'image/svg+xml', json: 'application/json', css: 'text/css', html: 'text/html', js: 'text/javascript', txt: 'text/plain' };
const ext = (p: string) => p.split('.').pop()?.toLowerCase() ?? '';

/**
 * Builds ONE self-contained HTML document for the sandboxed preview iframe:
 * local CSS and scripts are inlined, ES modules are rewritten to blob: URLs, local SVG/text images become data: URIs.
 * `revoke()` must be called when the preview is replaced.
 */
export function buildPreviewHtml(files: ProjectFile[], opts: { observer?: boolean } = {}): { html: string; entry: string | null; revoke: () => void } {
  const entry = findEntry(files);
  if (!entry) return { html: '', entry: null, revoke: () => {} };
  const byPath = new Map(files.map((f) => [f.path, f.content]));
  const blobs: string[] = [];
  const moduleUrls = new Map<string, string>();

  function moduleUrl(path: string, stack: string[] = []): string | null {
    if (moduleUrls.has(path)) return moduleUrls.get(path)!;
    const src = byPath.get(path);
    if (src === undefined || stack.includes(path)) return null; // missing file or import cycle
    const rewritten = src.replace(/(\bfrom\s*|\bimport\s*\(?\s*)(["'])(\.{1,2}\/[^"']+)\2/g, (m, pre, q, spec) => {
      const target = resolvePath(path, spec);
      const withExt = byPath.has(target) ? target : byPath.has(target + '.js') ? target + '.js' : target;
      const u = moduleUrl(withExt, [...stack, path]);
      return u ? `${pre}${q}${u}${q}` : m;
    });
    const url = URL.createObjectURL(new Blob([rewritten], { type: 'text/javascript' }));
    blobs.push(url);
    moduleUrls.set(path, url);
    return url;
  }

  let html = byPath.get(entry)!;
  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) return tag;
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!href || !isLocal(href)) return tag;
    const css = byPath.get(resolvePath(entry, href));
    return css === undefined ? tag : `<style>/* ${href} */\n${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  html = html.replace(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, src, b) => {
    if (!isLocal(src)) return tag;
    const path = resolvePath(entry, src);
    const code = byPath.get(path);
    if (code === undefined) return tag;
    const attrs = `${a} ${b}`;
    if (/type\s*=\s*["']module["']/i.test(attrs)) {
      const u = moduleUrl(path);
      return u ? `<script type="module" src="${u}"></script>` : tag;
    }
    return `<script${attrs.replace(/\s+/g, ' ').replace(/\s*(defer|async)\b/gi, '')}>${code.replace(/<\/script/gi, '<\\/script')}</script>`;
  });
  html = html.replace(/(<(?:img|source)\b[^>]*\bsrc\s*=\s*["'])([^"']+)(["'])/gi, (m, pre, src, post) => {
    if (!isLocal(src)) return m;
    const data = byPath.get(resolvePath(entry, src));
    const mime = MIME[ext(src)];
    return data !== undefined && mime ? `${pre}data:${mime};charset=utf-8,${encodeURIComponent(data)}${post}` : m;
  });
  if (opts.observer) html = injectObserver(html);
  return { html, entry, revoke: () => blobs.forEach((u) => URL.revokeObjectURL(u)) };
}

/** Runs a JS file in a Worker and captures console output (CLI preview). */
export function runJsInWorker(files: ProjectFile[], entry: string, onLine: (l: string, kind: 'out' | 'err') => void, timeoutMs = 10_000): { stop: () => void; done: Promise<void> } {
  const src = files.find((f) => f.path === entry)?.content ?? '';
  const code = `
    const __post = (k, v) => postMessage({ k, v });
    const __fmt = (a) => a.map((x) => typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch { return String(x); } })()).join(' ');
    console.log = (...a) => __post('out', __fmt(a)); console.info = console.log; console.warn = (...a) => __post('err', __fmt(a)); console.error = console.warn;
    self.process = { argv: ['node', ${JSON.stringify(entry)}], env: {}, exit: () => { __post('done'); close(); }, stdout: { write: (s) => __post('out', String(s)) } };
    try { ${src.replace(/^\s*#!.*\n/, '')}\n } catch (e) { __post('err', String(e && e.stack || e)); }
    __post('done');`;
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  const w = new Worker(url);
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  const timer = setTimeout(() => { onLine('⏱ تم الإيقاف بعد ' + timeoutMs / 1000 + ' ثانية', 'err'); stop(); }, timeoutMs);
  function stop() { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); finish(); }
  w.onmessage = (e) => { if (e.data.k === 'done') stop(); else onLine(String(e.data.v), e.data.k); };
  w.onerror = (e) => { onLine(e.message, 'err'); stop(); };
  return { stop, done };
}
