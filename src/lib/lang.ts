export interface LangMeta {
  id: string;
  label: string;
  glyph: string;
  color: string;
}

export const LANGS: Record<string, LangMeta> = {
  python: { id: 'python', label: 'Python', glyph: 'Py', color: '#3b82f6' },
  javascript: { id: 'javascript', label: 'JavaScript', glyph: 'JS', color: '#eab308' },
  typescript: { id: 'typescript', label: 'TypeScript', glyph: 'TS', color: '#2563eb' },
  dart: { id: 'dart', label: 'Dart / Flutter', glyph: 'Da', color: '#06b6d4' },
  kotlin: { id: 'kotlin', label: 'Kotlin', glyph: 'Kt', color: '#8b5cf6' },
  java: { id: 'java', label: 'Java', glyph: 'Jv', color: '#ef4444' },
  csharp: { id: 'csharp', label: 'C#', glyph: 'C#', color: '#7c3aed' },
  go: { id: 'go', label: 'Go', glyph: 'Go', color: '#14b8a6' },
  rust: { id: 'rust', label: 'Rust', glyph: 'Rs', color: '#f97316' },
  cpp: { id: 'cpp', label: 'C / C++', glyph: 'C+', color: '#0ea5e9' },
  php: { id: 'php', label: 'PHP', glyph: 'Ph', color: '#6366f1' },
  html: { id: 'html', label: 'HTML / CSS', glyph: '<>', color: '#f97316' },
  css: { id: 'css', label: 'CSS', glyph: '{}', color: '#38bdf8' },
  shell: { id: 'shell', label: 'Shell', glyph: '$_', color: '#22c55e' },
  sql: { id: 'sql', label: 'SQL', glyph: 'Sq', color: '#f59e0b' },
  json: { id: 'json', label: 'JSON', glyph: '{ }', color: '#a3a3a3' },
  yaml: { id: 'yaml', label: 'YAML', glyph: 'Ym', color: '#ef4444' },
  markdown: { id: 'markdown', label: 'Markdown', glyph: 'Md', color: '#94a3b8' },
  text: { id: 'text', label: 'Text', glyph: 'Tx', color: '#94a3b8' },
};

const EXT: Record<string, string> = {
  py: 'python', pyw: 'python', js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript', dart: 'dart', kt: 'kotlin', kts: 'kotlin', java: 'java', cs: 'csharp',
  go: 'go', rs: 'rust', c: 'cpp', h: 'cpp', cc: 'cpp', cpp: 'cpp', hpp: 'cpp', php: 'php', html: 'html', htm: 'html',
  css: 'css', scss: 'css', sh: 'shell', bash: 'shell', ps1: 'shell', bat: 'shell', sql: 'sql', json: 'json',
  yml: 'yaml', yaml: 'yaml', md: 'markdown', txt: 'text', xml: 'text', toml: 'text',
};

export function languageOf(path: string): string {
  const base = path.split('/').pop() ?? path;
  if (base === 'Dockerfile') return 'shell';
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  return EXT[ext] ?? 'text';
}

export function langMeta(id: string): LangMeta {
  return LANGS[id] ?? LANGS.text;
}

/** Languages that describe the "program", not config / docs. */
const NON_PRIMARY = new Set(['json', 'yaml', 'markdown', 'text', 'css', 'sql']);

export function primaryLanguage(paths: string[]): string {
  const counts: Record<string, number> = {};
  for (const p of paths) {
    const l = languageOf(p);
    if (NON_PRIMARY.has(l)) continue;
    counts[l] = (counts[l] ?? 0) + 1;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (best) return best[0];
  return paths.some((p) => languageOf(p) === 'css') ? 'html' : 'text';
}

export function detectProjectType(paths: string[]): 'website' | 'apk' | 'cli' | 'exe' | 'library' {
  const has = (re: RegExp) => paths.some((p) => re.test(p));
  if (has(/(^|\/)AndroidManifest\.xml$/) || has(/(^|\/)capacitor\.config\./) || has(/(^|\/)pubspec\.yaml$/)) return 'apk';
  if (has(/(^|\/)index\.html$/)) return 'website';
  if (has(/\.(csproj|sln)$/) || has(/(^|\/)tauri\.conf\.json$/)) return 'exe';
  if (has(/(^|\/)(main|cli|__main__)\.(py|go|rs|js|ts)$/)) return 'cli';
  return 'library';
}

export function basename(p: string): string {
  return p.split('/').pop() ?? p;
}

export function sortPaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const ad = a.includes('/') ? 0 : 1;
    const bd = b.includes('/') ? 0 : 1;
    return ad - bd || a.localeCompare(b);
  });
}
