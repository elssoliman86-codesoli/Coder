// Import skills (folders with a SKILL.md) from a GitHub repository link.
import type { Skill } from '../types';
import type { GithubClient } from '../github/client';
import { deriveTriggers } from './router';
import { pool } from '../lib/util';

export interface GhRef { owner: string; repo: string; ref?: string; path: string }

export function parseGithubUrl(input: string): GhRef | null {
  const s = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:tree|blob)\/([^/\s#?]+)(?:\/(.*?))?)?(?:[#?].*)?$/i) ?? s.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (!m) return null;
  return { owner: m[1], repo: m[2], ref: m[3] || undefined, path: (m[4] ?? '').replace(/^\/+|\/+$/g, '') };
}

/** Minimal front-matter reader: `key: value`, quoted values and folded/literal multi-line values. */
export function parseFrontMatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text.trim() };
  const meta: Record<string, string> = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const k = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!k) continue;
    let v = k[2].trim();
    if (/^[>|][+-]?$/.test(v) || v === '') {
      const parts: string[] = [];
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
      v = parts.join(' ');
    }
    meta[k[1].toLowerCase()] = v.replace(/^(["'])([\s\S]*)\1$/, '$2');
  }
  return { meta, body: text.slice(m[0].length).trim() };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skill';
const SKIP = /(^|\/)(node_modules|\.git|__pycache__)(\/|$)/;
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tar|7z|jar|exe|dll|so|woff2?|ttf|otf|mp3|mp4|mov|wasm|pyc|lock)$/i;
const MAX_FILE = 100_000;
const MAX_FILES = 40;

export interface SkillImport { skills: Skill[]; repo: string; ref: string; scanned: number; truncated: boolean }

export async function importSkillsFromGithub(gh: GithubClient, input: string, onProgress?: (msg: string) => void): Promise<SkillImport> {
  const r = parseGithubUrl(input);
  if (!r) throw new Error('الرابط مش شكل ريبو GitHub (مثال: https://github.com/owner/repo)');
  onProgress?.('بيقرأ الريبو…');
  const ref = r.ref ?? (await gh.defaultBranch(r.owner, r.repo));
  const tree = await gh.getTree(r.owner, r.repo, ref);
  const inScope = (p: string) => !r.path || p === r.path || p.startsWith(r.path + '/');
  const blobs = tree.tree.filter((e) => e.type === 'blob' && inScope(e.path) && !SKIP.test(e.path));
  const dirs = blobs.filter((e) => /(^|\/)skill\.md$/i.test(e.path)).map((e) => e.path.replace(/(^|\/)skill\.md$/i, '').replace(/\/$/, ''));
  if (!dirs.length) throw new Error('ما لقيتش أي مجلد فيه ملف SKILL.md في الرابط ده');
  // nested skills are separate; a file belongs to its closest skill folder
  const owner = (p: string) => dirs.filter((d) => d === '' || p.startsWith(d + '/')).sort((a, b) => b.length - a.length)[0];
  const fullName = `${r.owner}/${r.repo}`;
  const out: Skill[] = [];
  let done = 0;
  await pool(dirs, 3, async (dir) => {
    const mine = blobs.filter((e) => owner(e.path) === dir && !BINARY.test(e.path) && (e.size ?? 0) <= MAX_FILE).slice(0, MAX_FILES);
    const texts = new Map<string, string>();
    await pool(mine, 5, async (e) => {
      const bytes = await gh.getBlob(r.owner, r.repo, e.sha);
      if (bytes.subarray(0, 2000).includes(0)) return;
      try { texts.set(e.path, new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { /* not text */ }
    });
    const skillPath = [...texts.keys()].find((p) => /(^|\/)skill\.md$/i.test(p));
    if (!skillPath) return;
    const { meta, body } = parseFrontMatter(texts.get(skillPath)!);
    const dirName = dir.split('/').pop() || r.repo;
    const name = slug(meta.name || dirName);
    const description = meta.description || body.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.slice(0, 240) || name;
    const rel = (p: string) => (dir ? p.slice(dir.length + 1) : p);
    out.push({
      name,
      description,
      appliesTo: ['*'],
      triggers: deriveTriggers(name, description),
      autoTriggers: true,
      always: false,
      enabled: true,
      builtin: false,
      body,
      folder: fullName,
      files: [...texts].filter(([p]) => p !== skillPath).map(([p, content]) => ({ path: rel(p), content })).sort((a, b) => a.path.localeCompare(b.path)),
      source: { repo: fullName, path: dir, ref },
    });
    onProgress?.(`${++done}/${dirs.length} مهارة`);
  });
  // unique names
  const seen = new Set<string>();
  for (const s of out) { let n = s.name, i = 2; while (seen.has(n)) n = `${s.name}-${i++}`; s.name = n; seen.add(n); }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return { skills: out, repo: fullName, ref, scanned: blobs.length, truncated: tree.truncated };
}
