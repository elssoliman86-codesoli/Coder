import JSZip from 'jszip';
import type { ProjectFile } from '../types';

export const LIMITS = {
  maxEntries: 3000,
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 40 * 1024 * 1024,
};

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tar|7z|rar|jar|apk|aab|exe|dll|so|dylib|class|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|wasm|keystore|jks|db|sqlite)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.gradle|build|dist|__pycache__|\.idea|\.vscode|\.next|target)(\/|$)/;

export class ImportError extends Error {}

/** Normalises and validates a path coming from an archive. Returns null when it must be skipped. */
export function safePath(raw: string): string | null {
  const p = raw.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!p || p.endsWith('/')) return null;
  if (p.startsWith('/') || /^[a-zA-Z]:/.test(p)) throw new ImportError(`مسار غير آمن: ${raw}`);
  if (p.split('/').some((seg) => seg === '..')) throw new ImportError(`مسار غير آمن (..): ${raw}`);
  if (p.includes('\0')) throw new ImportError('اسم ملف غير صالح');
  return p;
}

function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

function stripCommonRoot(files: ProjectFile[]): ProjectFile[] {
  if (files.length === 0) return files;
  const first = files[0].path.split('/')[0];
  if (!files[0].path.includes('/')) return files;
  if (files.every((f) => f.path.startsWith(first + '/'))) {
    return files.map((f) => ({ ...f, path: f.path.slice(first.length + 1) }));
  }
  return files;
}

export interface ImportResult {
  files: ProjectFile[];
  skipped: string[];
}

export type Progress = (done: number, total: number) => void;
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export async function importZip(data: ArrayBuffer | Uint8Array | Blob, onProgress?: Progress): Promise<ImportResult> {
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(data); } catch { throw new ImportError('الملف ده مش zip سليم (أو تالف). جرّب تضغطه تاني.'); }
  const all = Object.values(zip.files).filter((e) => !e.dir);
  const files: ProjectFile[] = [];
  const skipped: string[] = [];
  // folders like node_modules/.git are dropped BEFORE the count limit, so a zip that includes them still imports
  const entries = all.filter((e) => {
    const p = e.name.replace(/\\/g, '/');
    if (SKIP_DIR.test(p) || BINARY_EXT.test(p)) { skipped.push(p); return false; }
    return true;
  });
  if (entries.length > LIMITS.maxEntries) throw new ImportError(`الأرشيف فيه ملفات كتير (${entries.length}) بعد استبعاد node_modules وغيرها`);
  let total = 0;
  let n = 0;
  for (const entry of entries) {
    if (++n % 40 === 0) { onProgress?.(n, entries.length); await tick(); } // keep the UI alive on big archives
    const path = safePath(entry.name);
    if (!path) continue;
    if (SKIP_DIR.test(path) || BINARY_EXT.test(path)) { skipped.push(path); continue; }
    const bytes = await entry.async('uint8array');
    total += bytes.length;
    if (total > LIMITS.maxTotalBytes) throw new ImportError('حجم الأرشيف بعد الفك كبير جدًا (حماية من zip bomb)');
    if (bytes.length > LIMITS.maxFileBytes || looksBinary(bytes)) { skipped.push(path); continue; }
    files.push({ path, content: new TextDecoder('utf-8').decode(bytes) });
  }
  return { files: stripCommonRoot(files), skipped };
}

export async function importFileList(list: File[], onProgress?: Progress): Promise<ImportResult> {
  const files: ProjectFile[] = [];
  const skipped: string[] = [];
  for (const f of list) {
    if (/\.zip$/i.test(f.name)) {
      const r = await importZip(await f.arrayBuffer(), onProgress);
      files.push(...r.files);
      skipped.push(...r.skipped);
      continue;
    }
    const path = safePath(f.name);
    if (!path) continue;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (BINARY_EXT.test(path) || looksBinary(bytes) || bytes.length > LIMITS.maxFileBytes) { skipped.push(path); continue; }
    files.push({ path, content: new TextDecoder('utf-8').decode(bytes) });
  }
  return { files, skipped };
}

export async function exportZip(files: ProjectFile[]): Promise<Blob> {
  const zip = new JSZip();
  for (const f of files) zip.file(f.path, f.content);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
