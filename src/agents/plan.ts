import type { Plan, ProjectType } from '../types';
import { safeRelPath } from './parse';

const TYPES: ProjectType[] = ['website', 'apk', 'cli', 'exe', 'library'];
const MAX_FILES = 40;

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : v == null ? d : String(v));
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => arr(v).map((x) => str(x)).filter(Boolean);

export interface PlanValidation {
  plan?: Plan;
  errors: string[];
}

/** Validates and normalises the Planner's JSON. Returns human-readable errors the model can fix. */
export function validatePlan(raw: unknown): PlanValidation {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') return { errors: ['الخطة ليست كائن JSON'] };
  const o = raw as Record<string, any>;

  const type = str(o.type).toLowerCase() as ProjectType;
  if (!TYPES.includes(type)) errors.push(`type لازم يكون واحد من: ${TYPES.join(', ')}`);

  const files: Plan['files'] = [];
  const seen = new Set<string>();
  for (const f of arr(o.files)) {
    const path = safeRelPath(str((f as any)?.path));
    if (!path) { errors.push(`مسار ملف غير صالح: ${str((f as any)?.path)}`); continue; }
    if (seen.has(path)) continue;
    seen.add(path);
    files.push({ path, purpose: str((f as any)?.purpose, '—') });
  }
  if (files.length === 0) errors.push('files فاضية — لازم قائمة ملفات كاملة');
  if (files.length > MAX_FILES) errors.push(`عدد الملفات (${files.length}) أكبر من الحد ${MAX_FILES}`);
  if (type === 'website' && !seen.has('index.html')) errors.push('المواقع لازم يكون فيها index.html');
  if (type === 'apk' && !seen.has('index.html')) errors.push('تطبيقات الـ apk (Capacitor) لازم يكون فيها index.html كنقطة دخول');

  const functions = arr(o.functions)
    .map((f: any) => ({ file: str(f?.file), name: str(f?.name), signature: str(f?.signature), description: str(f?.description) }))
    .filter((f) => f.name);
  for (const fn of functions) {
    if (fn.file && !seen.has(fn.file)) errors.push(`الدالة ${fn.name} بتشاور على ملف مش في قائمة الملفات: ${fn.file}`);
  }

  const CODE = /\.(js|mjs|cjs|jsx|ts|tsx|py|go|rs|java|kt|dart|cs|php|rb|swift|c|cpp)$/;
  const withFns = new Set(functions.map((f) => f.file));
  const missing = files.filter((f) => CODE.test(f.path) && !withFns.has(f.path)).map((f) => f.path);
  if (missing.length) errors.push(`كل ملف كود لازم يكون له دوال/كلاسات في functions. ناقص: ${missing.slice(0, 8).join(', ')}`);

  if (errors.length) return { errors };

  const d = (o.design ?? {}) as Record<string, any>;
  const plan: Plan = {
    summary: str(o.summary),
    targetUsers: str(o.targetUsers),
    type,
    primaryLanguage: str(o.primaryLanguage, 'javascript').toLowerCase(),
    stack: arr(o.stack).map((s: any) => ({
      category: str(s?.category),
      choice: str(s?.choice),
      version: str(s?.version, 'latest'),
      reason: str(s?.reason),
      verified: false, // versions are never verified offline — the UI shows them as unverified
    })),
    files,
    functions,
    screens: arr(o.screens).map((s: any) => ({ name: str(s?.name), route: str(s?.route, '/'), uiTerms: strs(s?.uiTerms) })),
    design: {
      style: str(d.style, 'Minimalism'),
      palette: typeof d.palette === 'object' && d.palette ? Object.fromEntries(Object.entries(d.palette).map(([k, v]) => [k, str(v)])) : {},
      typography: str(d.typography),
      spacing: str(d.spacing),
      motion: str(d.motion),
    },
    tests: strs(o.tests),
    risks: strs(o.risks),
    assumptions: strs(o.assumptions),
    openQuestions: strs(o.openQuestions),
  };
  return { plan, errors: [] };
}

export function planToMarkdown(name: string, p: Plan): string {
  const l: string[] = [];
  l.push(`# ${name} — خطة المشروع`, '', `**النوع:** ${p.type} · **اللغة الأساسية:** ${p.primaryLanguage}`, '', p.summary, '');
  if (p.targetUsers) l.push('## المستخدمون المستهدفون', p.targetUsers, '');
  if (p.stack.length) {
    l.push('## الـ Stack', '| الفئة | الاختيار | الإصدار | السبب |', '|---|---|---|---|');
    for (const s of p.stack) l.push(`| ${s.category} | ${s.choice} | ${s.version}${s.verified ? '' : ' (غير متحقق)'} | ${s.reason} |`);
    l.push('');
  }
  l.push('## الملفات');
  for (const f of p.files) l.push(`- \`${f.path}\` — ${f.purpose}`);
  l.push('');
  if (p.functions.length) {
    l.push('## جرد الدوال');
    for (const f of p.files) {
      const fns = p.functions.filter((x) => x.file === f.path);
      if (!fns.length) continue;
      l.push(`### \`${f.path}\``);
      for (const fn of fns) l.push(`- \`${fn.signature || fn.name}\` — ${fn.description}`);
    }
    l.push('');
  }
  if (p.screens.length) {
    l.push('## الشاشات');
    for (const s of p.screens) l.push(`- **${s.name}** (\`${s.route}\`) — ${s.uiTerms.join('، ') || '—'}`);
    l.push('');
  }
  l.push('## التصميم', `- الأسلوب: ${p.design.style}`, `- الخطوط: ${p.design.typography}`, `- المسافات: ${p.design.spacing}`, `- الحركة: ${p.design.motion}`);
  for (const [k, v] of Object.entries(p.design.palette)) l.push(`- لون ${k}: ${v}`);
  l.push('');
  if (p.tests.length) l.push('## خطة الاختبار', ...p.tests.map((t) => `- ${t}`), '');
  if (p.risks.length) l.push('## المخاطر', ...p.risks.map((t) => `- ${t}`), '');
  if (p.assumptions.length) l.push('## الافتراضات', ...p.assumptions.map((t) => `- ${t}`), '');
  if (p.openQuestions.length) l.push('## أسئلة مفتوحة', ...p.openQuestions.map((t) => `- ${t}`), '');
  return l.join('\n');
}
