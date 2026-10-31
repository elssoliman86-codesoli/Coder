// Import an existing GitHub repository as a project, and compute what changed when publishing back.
import type { GithubLink, ProjectFile } from '../types';
import type { GithubClient } from './client';
import { LIMITS, safePath } from '../lib/zip';
import { pool } from '../lib/util';

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|bmp|pdf|zip|gz|tar|7z|rar|jar|apk|aab|exe|dll|so|dylib|class|woff2?|ttf|otf|eot|mp3|mp4|mov|avi|wasm|keystore|jks|db|sqlite|lock)$/i;
const SKIP_DIR = /(^|\/)(node_modules|\.git|\.gradle|build|dist|__pycache__|\.idea|\.vscode|\.next|target|vendor|Pods)(\/|$)/;

/** git blob id of a text file: sha1("blob <bytes>\0" + bytes). */
export async function gitBlobSha(content: string): Promise<string> {
  const body = new TextEncoder().encode(content);
  const head = new TextEncoder().encode(`blob ${body.length}\0`);
  const all = new Uint8Array(head.length + body.length);
  all.set(head, 0);
  all.set(body, head.length);
  const digest = await crypto.subtle.digest('SHA-1', all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface ImportedRepo {
  files: ProjectFile[];
  link: GithubLink;
  skipped: number;
  truncated: boolean;
}

export async function importRepo(
  gh: GithubClient,
  repo: { fullName: string; htmlUrl: string },
  branch: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportedRepo> {
  const [owner, name] = repo.fullName.split('/');
  const tree = await gh.getTree(owner, name, branch);
  const wanted: { path: string; sha: string }[] = [];
  let skipped = 0;
  for (const e of tree.tree) {
    if (e.type !== 'blob') continue;
    let path: string | null = null;
    try { path = safePath(e.path); } catch { path = null; }
    if (!path || SKIP_DIR.test(path) || BINARY_EXT.test(path) || (e.size ?? 0) > LIMITS.maxFileBytes) { skipped++; continue; }
    wanted.push({ path, sha: e.sha });
  }
  if (wanted.length > LIMITS.maxEntries) { skipped += wanted.length - LIMITS.maxEntries; wanted.length = LIMITS.maxEntries; }
  const files: ProjectFile[] = [];
  const shas: Record<string, string> = {};
  let done = 0;
  let total = 0;
  await pool(wanted, 6, async (w) => {
    const bytes = await gh.getBlob(owner, name, w.sha);
    done++;
    onProgress?.(done, wanted.length);
    total += bytes.length;
    if (total > LIMITS.maxTotalBytes || bytes.subarray(0, 4000).includes(0)) { skipped++; return; }
    let text: string;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { skipped++; return; }
    files.push({ path: w.path, content: text });
    shas[w.path] = w.sha;
  });
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped, truncated: tree.truncated, link: { fullName: repo.fullName, htmlUrl: repo.htmlUrl, baseBranch: branch, branch, shas } };
}

/** Files that differ from what was imported (added/edited → content, removed → null). */
export async function diffAgainstImport(files: ProjectFile[], link: GithubLink): Promise<{ path: string; content: string | null }[]> {
  const changes: { path: string; content: string | null }[] = [];
  const now = new Set(files.map((f) => f.path));
  for (const f of files) {
    if (link.shas[f.path] !== (await gitBlobSha(f.content))) changes.push({ path: f.path, content: f.content });
  }
  for (const p of Object.keys(link.shas)) if (!now.has(p)) changes.push({ path: p, content: null });
  return changes;
}
