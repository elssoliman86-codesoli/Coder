import type { ProjectFile, ProjectType } from '../types';
import { languageOf } from '../lib/lang';

export interface Finding {
  file: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const dir = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
const isLocal = (u: string) => !/^([a-z]+:|\/\/|#|data:)/i.test(u) && !!u;

function resolve(from: string, ref: string): string {
  const clean = ref.split('#')[0].split('?')[0];
  const parts = (clean.startsWith('/') ? clean.slice(1) : dir(from) + clean).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

function checkJs(file: string, code: string, out: Finding[]) {
  const looksModule = /^\s*(import\s|export\s)/m.test(code) || /\bimport\s*\(/.test(code);
  try {
    if (looksModule) {
      // Syntax-check modules by wrapping them: strip import/export so the body can be parsed.
      const body = code
        .replace(/^\s*import\s[^;]*?from\s*['"][^'"]+['"];?/gm, '')
        .replace(/^\s*import\s*['"][^'"]+['"];?/gm, '')
        .replace(/^\s*export\s+default\s+/gm, 'var __d = ')
        .replace(/^\s*export\s+\{[^}]*\}(\s*from\s*['"][^'"]+['"])?;?/gm, '')
        .replace(/^\s*export\s+(?=(async\s+)?(function|class|const|let|var)\b)/gm, '');
      // eslint-disable-next-line no-new-func
      new Function(`return async function(){${body}\n}`);
    } else {
      // eslint-disable-next-line no-new-func
      new Function(code);
    }
  } catch (e) {
    if (e instanceof SyntaxError) out.push({ file, message: `خطأ صياغة JavaScript: ${e.message}`, severity: 'high' });
  }
}

function checkBalance(file: string, code: string, out: Finding[]) {
  const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""');
  const open = (stripped.match(/\{/g) ?? []).length;
  const close = (stripped.match(/\}/g) ?? []).length;
  if (open !== close) out.push({ file, message: `أقواس {} غير متوازنة (${open} مقابل ${close})`, severity: 'high' });
}

/** Lightweight "full code analysis": syntax, balance, broken local references. Runs in the browser. */
export function analyzeProject(files: ProjectFile[]): Finding[] {
  const out: Finding[] = [];
  const paths = new Set(files.map((f) => f.path));
  for (const f of files) {
    const lang = languageOf(f.path);
    if (f.content.trim() === '') out.push({ file: f.path, message: 'الملف فاضي', severity: 'medium' });
    if (lang === 'json') {
      try { JSON.parse(f.content); } catch (e) { out.push({ file: f.path, message: `JSON غير صالح: ${(e as Error).message}`, severity: 'high' }); }
    } else if (lang === 'javascript') {
      checkJs(f.path, f.content, out);
    } else if (lang === 'css') {
      checkBalance(f.path, f.content, out);
    } else if (lang === 'html') {
      const re = /<(?:script[^>]*\ssrc|link[^>]*\shref|img[^>]*\ssrc|a[^>]*\shref)\s*=\s*["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(f.content))) {
        const ref = m[1];
        if (!isLocal(ref)) continue;
        const target = resolve(f.path, ref);
        if (target && !paths.has(target) && !paths.has(target + '/index.html') && /\.(js|mjs|css|png|jpe?g|svg|json|webmanifest|html)$/i.test(target)) {
          out.push({ file: f.path, message: `مرجع لملف غير موجود: ${ref}`, severity: 'high' });
        }
      }
      const inline = f.content.matchAll(/<script(?![^>]*\ssrc)(?![^>]*type\s*=\s*["']?(?:module|application\/json|text\/template))[^>]*>([\s\S]*?)<\/script>/gi);
      for (const s of inline) checkJs(f.path + ' (inline script)', s[1], out);
    }
  }
  return out;
}

const SECRET_PATTERNS: [RegExp, string][] = [
  [/AKIA[0-9A-Z]{16}/, 'AWS access key'],
  [/gh[pousr]_[A-Za-z0-9]{30,}/, 'GitHub token'],
  [/github_pat_[A-Za-z0-9_]{30,}/, 'GitHub fine-grained token'],
  [/sk-[A-Za-z0-9_-]{24,}/, 'API key (sk-...)'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/, 'Private key'],
  [/xox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/AIza[0-9A-Za-z_-]{35}/, 'Google API key'],
];

/** Deterministic security scan used as input to (and a floor for) the Expert's audit. */
export function securityScan(files: ProjectFile[], type: ProjectType): Finding[] {
  const out: Finding[] = [];
  for (const f of files) {
    const lang = languageOf(f.path);
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(f.content)) out.push({ file: f.path, message: `سر مكتوب في الكود: ${label}`, severity: 'critical' });
    }
    if (/(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s]{8,}["']/i.test(f.content) && !/example|placeholder|your[_-]|xxx|<.*>/i.test(f.content)) {
      out.push({ file: f.path, message: 'قيمة تشبه سرًا مكتوبة مباشرة (password/token/api key)', severity: 'high' });
    }
    if (lang === 'javascript' || lang === 'html' || lang === 'typescript') {
      if (/\beval\s*\(/.test(f.content)) out.push({ file: f.path, message: 'استخدام eval()', severity: 'high' });
      if (/\bnew Function\s*\(/.test(f.content)) out.push({ file: f.path, message: 'استخدام new Function()', severity: 'high' });
      if (/document\.write\s*\(/.test(f.content)) out.push({ file: f.path, message: 'استخدام document.write()', severity: 'medium' });
      if (/\.innerHTML\s*\+?=(?!\s*["'`][^"'`$]*["'`]\s*;?\s*$)/m.test(f.content)) out.push({ file: f.path, message: 'innerHTML مع بيانات ديناميكية (خطر XSS) — استخدم textContent أو عقّم المدخلات', severity: 'medium' });
      if (/target\s*=\s*["']_blank["'](?![^>]*rel\s*=\s*["'][^"']*noopener)/i.test(f.content)) out.push({ file: f.path, message: 'target="_blank" بدون rel="noopener"', severity: 'low' });
    }
    if (lang === 'python' && /\b(os\.system|subprocess\.[a-z]+\([^)]*shell\s*=\s*True|pickle\.loads?|yaml\.load\()/.test(f.content)) {
      out.push({ file: f.path, message: 'استدعاء أوامر shell أو فك تسلسل غير آمن', severity: 'high' });
    }
    if (f.path.endsWith('AndroidManifest.xml')) {
      if (/usesCleartextTraffic\s*=\s*"true"/.test(f.content)) out.push({ file: f.path, message: 'usesCleartextTraffic=true', severity: 'high' });
      if (/MANAGE_EXTERNAL_STORAGE|READ_SMS|SEND_SMS|READ_CONTACTS/.test(f.content)) out.push({ file: f.path, message: 'صلاحيات خطرة/زائدة في الـ manifest', severity: 'high' });
    }
    if (/\.(env|pem|key|jks|keystore)$/i.test(f.path) && !/\.example$/i.test(f.path)) {
      out.push({ file: f.path, message: 'ملف حساس لا يجب أن يُنشر', severity: 'critical' });
    }
  }
  if ((type === 'website' || type === 'apk' || type === 'webapp') && !files.some((f) => /Content-Security-Policy/i.test(f.content))) {
    out.push({ file: 'index.html', message: 'لا توجد سياسة CSP (Content-Security-Policy) في الصفحة', severity: 'low' });
  }
  return out;
}

export function worst(findings: Finding[]): Finding['severity'] | null {
  const order: Finding['severity'][] = ['critical', 'high', 'medium', 'low'];
  for (const s of order) if (findings.some((f) => f.severity === s)) return s;
  return null;
}
