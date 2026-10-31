// Runners for the "terminal" preview: Python (Pyodide in a Worker), JavaScript (Worker) and a remote Piston runner.
import type { ProjectFile } from '../types';
import { REMOTE_LANGS } from './preview-kind';

export type Emit = (line: string, kind: 'out' | 'err') => void;
export interface Job { stop: () => void; done: Promise<void> }

export const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/';

const PY_WORKER = String.raw`
var post = function (k, t) { self.postMessage({ k: k, t: t }); };
self.onmessage = async function (e) {
  var files = e.data.files, entry = e.data.entry, base = e.data.base;
  try {
    post('out', 'تحميل Python (Pyodide)… أول مرة بياخد وقت');
    importScripts(base + 'pyodide.js');
    var py = await loadPyodide({ indexURL: base });
    py.setStdout({ batched: function (s) { post('out', s); } });
    py.setStderr({ batched: function (s) { post('err', s); } });
    py.setStdin({ stdin: function () { return null; } });
    var root = '/home/pyodide/proj';
    py.FS.mkdirTree(root);
    Object.keys(files).forEach(function (p) {
      var full = root + '/' + p, d = full.slice(0, full.lastIndexOf('/'));
      py.FS.mkdirTree(d);
      py.FS.writeFile(full, files[p]);
    });
    py.FS.chdir(root);
    py.runPython('import sys; sys.path.insert(0, "' + root + '")');
    var all = Object.keys(files).filter(function (p) { return /\.py$/.test(p); }).map(function (p) { return files[p]; }).join('\n');
    await py.loadPackagesFromImports(all);
    await py.runPythonAsync('import runpy\nrunpy.run_path(' + JSON.stringify(entry) + ', run_name="__main__")');
    post('done', '');
  } catch (err) { post('err', String(err && err.message || err)); post('done', ''); }
};`;

/** Runs a Python project in the browser with Pyodide (stdlib + the packages Pyodide ships). */
export function runPython(files: ProjectFile[], entry: string, emit: Emit, timeoutMs = 120_000): Job {
  const url = URL.createObjectURL(new Blob([PY_WORKER], { type: 'text/javascript' }));
  const w = new Worker(url);
  let finish!: () => void;
  const done = new Promise<void>((r) => { finish = r; });
  const timer = setTimeout(() => { emit('انتهت مهلة التشغيل', 'err'); stop(); }, timeoutMs);
  function stop() { clearTimeout(timer); w.terminate(); URL.revokeObjectURL(url); finish(); }
  w.onmessage = (e) => {
    const { k, t } = e.data as { k: string; t: string };
    if (k === 'done') { stop(); return; }
    emit(t, k === 'err' ? 'err' : 'out');
  };
  w.onerror = (e) => { emit(e.message || 'Worker error', 'err'); stop(); };
  const map: Record<string, string> = {};
  for (const f of files) if (!f.path.includes('..')) map[f.path] = f.content;
  w.postMessage({ files: map, entry, base: PYODIDE_BASE });
  return { stop, done };
}

// ---------- remote (Piston-compatible) ----------

const MAIN_RE = /(^|\/)(main|index|app|program|Main|Program|Application|App)\./;

/** Picks the entry file for a language and returns it first (Piston treats the first file as the main one). */
export function pickRemoteFiles(files: ProjectFile[], lang: string): { files: ProjectFile[]; entry: string } | null {
  const same = files.filter((f) => REMOTE_LANGS[f.path.split('.').pop()!.toLowerCase()] === lang);
  if (!same.length) return null;
  const entry = same.find((f) => MAIN_RE.test(f.path)) ?? same.find((f) => /\bmain\s*\(|fn main|func main|static void main|<\?php/.test(f.content)) ?? same[0];
  return { entry: entry.path, files: [entry, ...same.filter((f) => f !== entry)] };
}

export function buildPistonRequest(files: ProjectFile[], lang: string): { language: string; version: string; files: { name: string; content: string }[] } | null {
  const picked = pickRemoteFiles(files, lang);
  if (!picked) return null;
  return { language: lang, version: '*', files: picked.files.map((f) => ({ name: f.path.split('/').pop()!, content: f.content })) };
}

export function runRemote(endpoint: string, files: ProjectFile[], lang: string, emit: Emit, fetchImpl: typeof fetch = fetch): Job {
  const ac = new AbortController();
  const req = buildPistonRequest(files, lang);
  const done = (async () => {
    if (!req) { emit('مفيش ملف مناسب للتشغيل', 'err'); return; }
    if (!endpoint) { emit('اكتب رابط الـ runner في الإعدادات (Piston API).', 'err'); return; }
    emit(`بيتبعت للتشغيل على ${new URL(endpoint).host}…`, 'out');
    try {
      const res = await fetchImpl(endpoint.replace(/\/+$/, '') + '/execute', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req), signal: ac.signal });
      const text = await res.text();
      if (!res.ok) { emit(`الـ runner رجّع ${res.status}: ${text.slice(0, 300)}`, 'err'); return; }
      const j = JSON.parse(text);
      const c = j.compile;
      if (c?.stdout) emit(c.stdout, 'out');
      if (c?.stderr) emit(c.stderr, 'err');
      if (j.run?.stdout) emit(j.run.stdout, 'out');
      if (j.run?.stderr) emit(j.run.stderr, 'err');
      emit(`— انتهى (exit ${j.run?.code ?? '?'})`, 'out');
    } catch (e) {
      if (!ac.signal.aborted) emit(`تعذر الوصول للـ runner: ${(e as Error).message}`, 'err');
    }
  })();
  return { stop: () => ac.abort(), done };
}
