import type { Plan, Project, ProjectFile, Role, Skill } from '../types';
import type { ChatMessage } from '../llm/client';
import { selectSkills, skillsPrompt } from '../skills/router';
import { uiVocabulary } from '../ui-reference/lookup';
import { throwIfAborted } from '../lib/util';
import { primaryLanguage } from '../lib/lang';
import { CODER_SYSTEM, CRITIC_SYSTEM, EDITOR_SYSTEM, EXPERT_FIX_SYSTEM, EXPERT_SCORE_SYSTEM, FIXER_SYSTEM, PLANNER_SYSTEM, PLAN_REVIEW_SYSTEM, MOCK_SYSTEM } from './prompts';
import { FileStreamParser, extractJson, stripCodeFence } from './parse';
import { planToMarkdown, validatePlan } from './plan';
import { analyzeProject, securityScan, worst, type Finding } from './analysis';
import type { ObservedIssue } from './observer';

export interface RunCtx {
  signal: AbortSignal;
  skills: Skill[];
  live?: boolean;
  getProject(): Project;
  patch(fn: (p: Project) => void): void;
  commitFile(path: string, content: string): void;
  draft(path: string, text: string | null): void;
  log(msg: string, kind?: 'info' | 'ok' | 'warn' | 'error'): void;
  chat(role: Role, messages: ChatMessage[], onToken?: (t: string) => void): Promise<string>;
}

// ---------- helpers ----------

export function filesContext(files: ProjectFile[], opts: { perFile?: number; total?: number; only?: string[] } = {}): string {
  const perFile = opts.perFile ?? 12_000;
  let budget = opts.total ?? 80_000;
  const parts: string[] = [];
  for (const f of files) {
    if (opts.only && !opts.only.includes(f.path)) continue;
    if (budget <= 0) { parts.push(`(… ${files.length - parts.length} more files omitted for size)`); break; }
    let c = f.content;
    if (c.length > perFile) c = c.slice(0, perFile) + `\n… (truncated, ${f.content.length} chars total)`;
    budget -= c.length;
    parts.push(`--- ${f.path} ---\n${c}`);
  }
  return parts.join('\n\n');
}

function skillBlock(ctx: RunCtx, p: Project | null, role: Role, description: string): string {
  return skillsPrompt(selectSkills(ctx.skills, description, p ? p.type : 'any', role));
}

function planBrief(plan: Plan): string {
  return [
    `Summary: ${plan.summary}`,
    `Type: ${plan.type}; language: ${plan.primaryLanguage}`,
    `Design: style=${plan.design.style}; palette=${JSON.stringify(plan.design.palette)}; typography=${plan.design.typography}; spacing=${plan.design.spacing}; motion=${plan.design.motion}`,
    `Files:\n${plan.files.map((f) => `- ${f.path}: ${f.purpose}`).join('\n')}`,
  ].join('\n');
}

export function buildDesignNotes(plan: Plan, terms: string[], style: string): string {
  const used = new Set<string>(terms);
  for (const s of plan.screens) for (const t of s.uiTerms) used.add(t);
  const l = ['# Design notes', '', `Visual style: **${style}**`, '', '## UI vocabulary used (NameThatUI)', ''];
  for (const t of used) l.push(`- ${t}`);
  l.push('', '## Screens', '');
  for (const s of plan.screens) l.push(`- **${s.name}** (${s.route}): ${s.uiTerms.join(', ') || '—'}`);
  l.push('', '## Tokens', '');
  for (const [k, v] of Object.entries(plan.design.palette)) l.push(`- ${k}: ${v}`);
  l.push('', '_UI vocabulary: NameThatUI — https://namethatui.com_', '');
  return l.join('\n');
}

// ---------- planner ----------

/** Second pass: a reviewer checks the plan against the description and may return a corrected full plan. */
async function reviewPlan(ctx: RunCtx, description: string, plan: Plan): Promise<Plan> {
  try {
    ctx.log('مراجعة الخطة مقابل الوصف…');
    const reply = await ctx.chat('planner', [
      { role: 'system', content: PLAN_REVIEW_SYSTEM },
      { role: 'user', content: `Description:\n${description}\n\nPlan JSON:\n${JSON.stringify(plan)}` },
    ]);
    if (/^\s*PLAN_OK\s*$/.test(reply)) { ctx.log('الخطة اتراجعت وسليمة', 'ok'); return plan; }
    const revised = validatePlan(extractJson(reply));
    if (revised.plan && revised.plan.files.length >= plan.files.length) {
      ctx.log(`المراجع حسّن الخطة: ${revised.plan.files.length} ملف، ${revised.plan.functions.length} دالة`, 'ok');
      return revised.plan;
    }
    ctx.log('تعديل المراجع مش صالح — هستخدم الخطة الأصلية', 'warn');
  } catch (e) {
    if (ctx.signal.aborted) throw e;
    ctx.log('تعذرت مراجعة الخطة — هستخدم الخطة الأصلية', 'warn');
  }
  return plan;
}

export async function planProject(ctx: RunCtx): Promise<Plan> {
  const p = ctx.getProject();
  ctx.patch((x) => { x.status = 'planning'; });
  ctx.log('الـ Planner بيحلل الوصف…');
  const vocab = await uiVocabulary(p.description, { live: ctx.live });
  const imported = p.files.length
    ? `\n\nThe project already contains these imported files (plan around them, keep what works):\n${p.files.map((f) => `- ${f.path} (${f.content.length} chars)`).join('\n')}\n\n${filesContext(p.files, { perFile: 2500, total: 20_000 })}`
    : '';
  const system = [PLANNER_SYSTEM, skillBlock(ctx, null, 'planner', p.description)].filter(Boolean).join('\n\n');
  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    { role: 'user', content: `Project name: ${p.name}\n\nDescription:\n${p.description}${imported}\n\n${vocab.text}\n\nReturn the plan JSON now.` },
  ];
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    throwIfAborted(ctx.signal);
    let acc = '';
    ctx.draft('PLAN.json', '');
    let reply: string;
    try {
      reply = await ctx.chat('planner', messages, (t) => { acc += t; ctx.draft('PLAN.json', acc); });
    } finally {
      ctx.draft('PLAN.json', null);
    }
    try {
      const { plan: first, errors } = validatePlan(extractJson(reply), { strict: attempt === 0 });
      let plan = first;
      if (plan) plan = await reviewPlan(ctx, p.description, plan);
      if (plan) {
        const md = planToMarkdown(p.name, plan);
        ctx.patch((x) => {
          x.plan = plan;
          x.planMd = md;
          x.type = plan.type;
          x.style = plan.design.style;
          x.primaryLanguage = plan.primaryLanguage;
          x.status = 'coding';
        });
        ctx.log(`الخطة جاهزة: ${plan.files.length} ملف، ${plan.functions.length} دالة`, 'ok');
        return plan;
      }
      lastErrors = errors;
    } catch (e) {
      lastErrors = [(e as Error).message];
    }
    ctx.log(`الخطة فيها مشاكل (محاولة ${attempt + 1}/3): ${lastErrors.join(' | ')}`, 'warn');
    messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `The plan is invalid. Fix these errors and return the full JSON again. Reply with ONLY the JSON object (no prose, no markdown, no reasoning text) and keep descriptions short so the reply is not cut off:\n- ${lastErrors.join('\n- ')}` });
  }
  ctx.patch((x) => { x.status = 'error'; });
  throw new Error('فشل الـ Planner في إنتاج خطة صالحة: ' + lastErrors.join(' | '));
}

// ---------- coder (new project) ----------

export async function generateProject(ctx: RunCtx): Promise<void> {
  let p = ctx.getProject();
  if (!p.plan) throw new Error('لا توجد خطة');
  const plan = p.plan;
  const vocab = await uiVocabulary(p.description, { live: false, style: plan.design.style });
  const system = [CODER_SYSTEM, skillBlock(ctx, p, 'coder', p.description), vocab.text].filter(Boolean).join('\n\n');
  const total = plan.files.length;
  let done = 0;
  for (const f of plan.files) {
    throwIfAborted(ctx.signal);
    p = ctx.getProject();
    const existing = p.files.find((x) => x.path === f.path);
    done++;
    if (existing && existing.content.trim()) {
      ctx.log(`(${done}/${total}) ${f.path} موجود — تم التخطي`);
      continue;
    }
    ctx.log(`(${done}/${total}) الـ Coder بيكتب ${f.path}`);
    const fns = plan.functions.filter((x) => x.file === f.path);
    const written = p.files.filter((x) => x.path !== f.path);
    const user = [
      `Project: ${p.name}`,
      `Original description:\n${p.description}`,
      `Plan:\n${planBrief(plan)}`,
      fns.length ? `Functions required in ${f.path}:\n${fns.map((x) => `- ${x.signature || x.name}: ${x.description}`).join('\n')}` : '',
      written.length ? `Files already written (keep consistent with them):\n${filesContext(written, { perFile: 5000, total: 40_000 })}` : '',
      `Write the complete content of \`${f.path}\` now (${f.purpose}). Output only the raw file content.`,
    ].filter(Boolean).join('\n\n');
    let acc = '';
    ctx.draft(f.path, '');
    try {
      acc = await ctx.chat('coder', [{ role: 'system', content: system }, { role: 'user', content: user }], (t) => {
        acc += t;
        ctx.draft(f.path, acc);
      });
    } catch (e) {
      ctx.draft(f.path, null);
      throw e;
    }
    const content = stripCodeFence(acc).replace(/\s+$/, '') + '\n';
    ctx.commitFile(f.path, content);
    ctx.draft(f.path, null);
  }
  p = ctx.getProject();
  const extra: ProjectFile[] = [];
  if (p.planMd) extra.push({ path: 'PLAN.md', content: p.planMd });
  if (p.type === 'website' || p.type === 'webapp' || p.type === 'apk' || p.type === 'exe') extra.push({ path: 'design-notes.md', content: buildDesignNotes(plan, vocab.terms, plan.design.style) });
  for (const e of extra) ctx.commitFile(e.path, e.content);
  const issues = analyzeProject(ctx.getProject().files).filter((i) => i.severity === 'high' || i.severity === 'critical');
  ctx.patch((x) => { x.status = 'ready'; x.primaryLanguage = primaryLanguage(x.files.map((f) => f.path)); });
  if (issues.length) ctx.log(`التحليل لقى ${issues.length} مشكلة — هتتصلح في دورة المراجعة: ${issues.slice(0, 3).map((i) => `${i.file}: ${i.message}`).join(' | ')}`, 'warn');
  else ctx.log('اكتملت كتابة المشروع والتحليل نضيف', 'ok');
}

// ---------- coder (edits) / fixer share the multi-file apply ----------

async function applyFileBlocks(ctx: RunCtx, role: Role, messages: ChatMessage[]): Promise<string[]> {
  const parser = new FileStreamParser({
    onStart: (path) => ctx.draft(path, ''),
    onChunk: (path) => ctx.draft(path, parser.files.get(path) ?? ''),
  });
  await ctx.chat(role, messages, (t) => parser.feed(t));
  parser.end();
  const changed: string[] = [];
  for (const [path, content] of parser.files) {
    ctx.draft(path, null);
    if (!content.trim()) continue;
    ctx.commitFile(path, content.endsWith('\n') ? content : content + '\n');
    changed.push(path);
  }
  return changed;
}

export async function applyEdit(ctx: RunCtx, instruction: string): Promise<string[]> {
  const p = ctx.getProject();
  const vocab = await uiVocabulary(p.description + ' ' + instruction, { live: false, style: p.plan?.design.style ?? p.style });
  const system = [EDITOR_SYSTEM, skillBlock(ctx, p, 'coder', p.description + ' ' + instruction), vocab.text].filter(Boolean).join('\n\n');
  const user = [
    p.plan ? `Plan:\n${planBrief(p.plan)}` : `Project description:\n${p.description}`,
    `Current files:\n${filesContext(p.files)}`,
    `Change request:\n${instruction}`,
  ].join('\n\n');
  ctx.log('الـ Coder بيطبّق التعديل…');
  const changed = await applyFileBlocks(ctx, 'coder', [{ role: 'system', content: system }, { role: 'user', content: user }]);
  if (changed.length === 0) throw new Error('الموديل ما رجّعش أي ملفات معدّلة');
  ctx.patch((x) => {
    if (!x.plan) return;
    for (const path of changed) if (!x.plan.files.some((f) => f.path === path)) x.plan.files.push({ path, purpose: 'added by an edit request' });
  });
  ctx.log(`تم تعديل ${changed.length} ملف: ${changed.join(', ')}`, 'ok');
  return changed;
}

// ---------- visual critic + fixer ----------

export interface CriticIssue {
  id: string;
  element: string;
  file: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface CriticResult {
  summary: string;
  issues: CriticIssue[];
}

export function validateCritic(raw: unknown, files: ProjectFile[]): CriticResult {
  const o = (raw ?? {}) as any;
  const paths = new Set(files.map((f) => f.path));
  const fallback = files.find((f) => /\.css$/.test(f.path))?.path ?? files.find((f) => /\.html$/.test(f.path))?.path ?? files[0]?.path ?? '';
  const issues: CriticIssue[] = (Array.isArray(o.issues) ? o.issues : [])
    .map((i: any, n: number) => ({
      id: String(i?.id ?? `I${n + 1}`),
      element: String(i?.element ?? ''),
      file: paths.has(String(i?.file)) ? String(i.file) : fallback,
      type: String(i?.type ?? 'layout'),
      severity: (['low', 'medium', 'high'].includes(i?.severity) ? i.severity : 'medium') as CriticIssue['severity'],
      description: String(i?.description ?? ''),
      suggestion: String(i?.suggestion ?? ''),
    }))
    .filter((i: CriticIssue) => i.description);
  return { summary: String(o.summary ?? ''), issues };
}

export async function runCritic(ctx: RunCtx, input: { observed: ObservedIssue[]; userCritique?: string; bodyText?: string }): Promise<CriticResult> {
  const p = ctx.getProject();
  const system = [CRITIC_SYSTEM, skillBlock(ctx, p, 'critic', p.description + ' ' + (input.userCritique ?? ''))].filter(Boolean).join('\n\n');
  const user = [
    `Original description:\n${p.description}`,
    p.plan ? `Design brief:\n${JSON.stringify(p.plan.design)}` : '',
    `Measured in the live preview (${input.observed.length} problems):\n${input.observed.length ? input.observed.map((i) => `- [${i.severity}] ${i.type} @ ${i.selector}: ${i.message}`).join('\n') : '(none measured)'}`,
    input.bodyText ? `Visible text on screen (first 1500 chars):\n${input.bodyText}` : '',
    input.userCritique ? `Note from the user (treat as a hard requirement):\n${input.userCritique}` : '',
    `Project files (${p.files.length}): ${p.files.map((f) => f.path).join(', ')}`,
    `Contents of the UI files:\n${filesContext(p.files.filter((f) => /\.(html|css|js|jsx|tsx|vue|svelte)$/.test(f.path)), { perFile: 10_000, total: 50_000 })}`,
  ].filter(Boolean).join('\n\n');
  ctx.log('الـ Visual Critic بيقارن اللي اتعرض بالوصف ويجمّع كل المشاكل…');
  let lastErr = '';
  const messages: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await ctx.chat('critic', messages);
    try {
      const r = validateCritic(extractJson(reply), p.files);
      ctx.log(`الـ Critic لقى ${r.issues.length} مشكلة`, r.issues.length ? 'warn' : 'ok');
      return r;
    } catch (e) {
      lastErr = (e as Error).message;
      messages.push({ role: 'assistant', content: reply }, { role: 'user', content: `Invalid reply (${lastErr}). Return only the JSON object.` });
    }
  }
  throw new Error('فشل الـ Critic: ' + lastErr);
}

export interface FixResult {
  changed: string[];
  remaining: Finding[];
}

export async function runFixer(ctx: RunCtx, issues: CriticIssue[]): Promise<FixResult> {
  const p = ctx.getProject();
  const involved = new Set(issues.map((i) => i.file));
  const system = [FIXER_SYSTEM, skillBlock(ctx, p, 'fixer', p.description)].filter(Boolean).join('\n\n');
  const changed = new Set<string>();
  const list = issues.map((i) => `- (${i.id}) [${i.severity}/${i.type}] ${i.element} in ${i.file}: ${i.description} → ${i.suggestion}`).join('\n');
  ctx.log(`الـ Fixer بيفتح ${involved.size} ملف ويصلح ${issues.length} مشكلة مرة واحدة…`);
  let current = ctx.getProject().files;
  let user = `Problems to fix (all of them, in one pass):\n${list}\n\nFiles involved:\n${filesContext(current, { only: [...involved], perFile: 30_000 })}\n\nOther files for reference:\n${filesContext(current.filter((f) => !involved.has(f.path)), { perFile: 3000, total: 20_000 })}`;
  let remaining: Finding[] = [];
  for (let round = 0; round < 3; round++) {
    throwIfAborted(ctx.signal);
    const got = await applyFileBlocks(ctx, 'fixer', [{ role: 'system', content: system }, { role: 'user', content: user }]);
    got.forEach((g) => changed.add(g));
    current = ctx.getProject().files;
    remaining = analyzeProject(current).filter((f) => f.severity === 'high' || f.severity === 'critical');
    if (remaining.length === 0) break;
    ctx.log(`التحليل الكامل لقى ${remaining.length} خطأ — جولة إصلاح تانية`, 'warn');
    const files = [...new Set(remaining.map((r) => r.file.replace(/ \(inline script\)$/, '')))];
    user = `The analysis still reports errors after your fix. Fix them:\n${remaining.map((r) => `- ${r.file}: ${r.message}`).join('\n')}\n\nFiles:\n${filesContext(current, { only: files, perFile: 30_000 })}`;
  }
  if (changed.size === 0) throw new Error('الـ Fixer ما غيّرش أي ملف');
  ctx.log(remaining.length ? `اتصلح ${changed.size} ملف لكن لسه فيه ${remaining.length} خطأ` : `اتصلح ${changed.size} ملف والتحليل الكامل نضيف`, remaining.length ? 'warn' : 'ok');
  return { changed: [...changed], remaining };
}

export async function runFixCycle(ctx: RunCtx, input: { observed: ObservedIssue[]; userCritique?: string; bodyText?: string }): Promise<{ critic: CriticResult; fix: FixResult | null }> {
  const critic = await runCritic(ctx, input);
  if (critic.issues.length === 0) return { critic, fix: null };
  const fix = await runFixer(ctx, critic.issues);
  ctx.patch((x) => { x.reviewCycles += 1; });
  return { critic, fix };
}

// ---------- expert (review, security, quality gate) ----------

export interface ExpertReport {
  score: number;
  criteria: Record<string, number>;
  blockers: string[];
  summary: string;
  passed: boolean;
  rounds: number;
  security: Finding[];
  analysis: Finding[];
}

const CRITERIA = ['correctness', 'security', 'structure', 'tests', 'documentation', 'uiQuality', 'accessibility', 'performance', 'dependencies', 'releaseReadiness'];

/** The final score can never exceed what deterministic checks allow. */
export function capScore(llmScore: number, security: Finding[], analysis: Finding[]): number {
  let cap = 10;
  const sec = worst(security);
  if (sec === 'critical') cap = Math.min(cap, 3);
  else if (sec === 'high') cap = Math.min(cap, 6);
  else if (sec === 'medium') cap = Math.min(cap, 9);
  const an = worst(analysis);
  if (an === 'critical' || an === 'high') cap = Math.min(cap, 7);
  else if (an === 'medium') cap = Math.min(cap, 9);
  return Math.max(0, Math.min(10, Math.round(llmScore), cap));
}

export function passesGate(report: Pick<ExpertReport, 'score' | 'blockers'>): boolean {
  return report.score === 10 && report.blockers.length === 0;
}

export function parseScore(raw: unknown): { score: number; criteria: Record<string, number>; blockers: string[]; summary: string } {
  const o = (raw ?? {}) as any;
  const criteria: Record<string, number> = {};
  for (const k of CRITERIA) criteria[k] = Math.max(0, Math.min(10, Number(o?.criteria?.[k] ?? 0) || 0));
  const score = Math.max(0, Math.min(10, Math.round(Number(o?.score) || 0)));
  return { score, criteria, blockers: (Array.isArray(o?.blockers) ? o.blockers : []).map(String).filter(Boolean), summary: String(o?.summary ?? '') };
}

export async function runExpert(ctx: RunCtx, maxRounds = 3): Promise<ExpertReport> {
  let report: ExpertReport | null = null;
  for (let round = 1; round <= maxRounds; round++) {
    throwIfAborted(ctx.signal);
    const p = ctx.getProject();
    const analysis = analyzeProject(p.files);
    const security = securityScan(p.files, p.type);
    const system = [EXPERT_FIX_SYSTEM, skillBlock(ctx, p, 'expert', p.description)].filter(Boolean).join('\n\n');
    const findingsText = [...analysis.map((f) => `analysis/${f.severity}: ${f.file}: ${f.message}`), ...security.map((f) => `security/${f.severity}: ${f.file}: ${f.message}`)].join('\n') || '(none)';
    ctx.log(`الخبير — جولة ${round}: مراجعة الكود والفحص الأمني وتنظيف المشروع…`);
    const user = `Project: ${p.name} (${p.type}, ${p.primaryLanguage})\nDescription:\n${p.description}\n\nAutomatic findings:\n${findingsText}\n\nAll files:\n${filesContext(p.files, { perFile: 20_000, total: 120_000 })}`;
    const parser = new FileStreamParser({ onStart: (path) => ctx.draft(path, ''), onChunk: (path) => ctx.draft(path, parser.files.get(path) ?? '') });
    const reply = await ctx.chat('expert', [{ role: 'system', content: system }, { role: 'user', content: user }], (t) => parser.feed(t));
    parser.end();
    let changed = 0;
    if (!/^\s*NO_CHANGES\s*$/.test(reply)) {
      for (const [path, content] of parser.files) {
        ctx.draft(path, null);
        if (!content.trim()) continue;
        ctx.commitFile(path, content.endsWith('\n') ? content : content + '\n');
        changed++;
      }
    }
    ctx.log(changed ? `الخبير عدّل ${changed} ملف` : 'الخبير ما لقاش حاجة تتعدّل', changed ? 'ok' : 'info');

    const after = ctx.getProject();
    const analysis2 = analyzeProject(after.files);
    const security2 = securityScan(after.files, after.type);
    const scoreUser = `Project: ${after.name} (${after.type})\nAutomatic analysis findings:\n${analysis2.map((f) => `- ${f.severity}: ${f.file}: ${f.message}`).join('\n') || '(none)'}\nSecurity scan findings:\n${security2.map((f) => `- ${f.severity}: ${f.file}: ${f.message}`).join('\n') || '(none)'}\n\nFiles:\n${filesContext(after.files, { perFile: 12_000, total: 100_000 })}`;
    let parsed: ReturnType<typeof parseScore> | null = null;
    const msgs: ChatMessage[] = [{ role: 'system', content: EXPERT_SCORE_SYSTEM }, { role: 'user', content: scoreUser }];
    for (let a = 0; a < 2 && !parsed; a++) {
      const r = await ctx.chat('expert', msgs);
      try { parsed = parseScore(extractJson(r)); } catch (e) { msgs.push({ role: 'assistant', content: r }, { role: 'user', content: `Invalid (${(e as Error).message}). Return only the JSON.` }); }
    }
    if (!parsed) throw new Error('الخبير لم يُرجع تقييمًا صالحًا');
    const score = capScore(parsed.score, security2, analysis2);
    const blockers = [...parsed.blockers];
    for (const f of security2.filter((x) => x.severity === 'critical' || x.severity === 'high')) blockers.push(`[أمان/${f.severity}] ${f.file}: ${f.message}`);
    for (const f of analysis2.filter((x) => x.severity === 'critical' || x.severity === 'high')) blockers.push(`[تحليل] ${f.file}: ${f.message}`);
    report = { score, criteria: parsed.criteria, blockers: [...new Set(blockers)], summary: parsed.summary, passed: false, rounds: round, security: security2, analysis: analysis2 };
    report.passed = passesGate(report);
    ctx.log(`تقييم الخبير: ${score}/10${report.passed ? ' ✓' : ` — ${report.blockers.length} عائق`}`, report.passed ? 'ok' : 'warn');
    if (report.passed) break;
  }
  return report!;
}


// ---------- visual simulation for apps that cannot run in the browser ----------

/** Asks the coder model for an interactive HTML simulation of the app and stores it on the project. */
export async function generateMock(ctx: RunCtx): Promise<string> {
  const p = ctx.getProject();
  const ui = p.files.filter((f) => /\.(xml|kt|java|dart|xaml|cs|fxml|py|swift|vue|svelte|html|css|js|jsx|tsx|ts|md)$/i.test(f.path) && !/(^|\/)(build|node_modules)\//.test(f.path));
  const user = [
    `Project: ${p.name} (${p.type}, ${p.primaryLanguage})`,
    `Description:\n${p.description}`,
    p.plan ? `Design brief:\n${JSON.stringify(p.plan.design)}\nScreens:\n${JSON.stringify(p.plan.screens)}` : '',
    `Project files:\n${filesContext(ui, { perFile: 6000, total: 70_000 })}`,
    'Write the HTML simulation now.',
  ].filter(Boolean).join('\n\n');
  ctx.log('بيرسم محاكاة مرئية للتطبيق من الكود…');
  ctx.draft('preview-simulation.html', '');
  let acc = '';
  let reply: string;
  try {
    reply = await ctx.chat('coder', [{ role: 'system', content: MOCK_SYSTEM }, { role: 'user', content: user }], (t) => { acc += t; ctx.draft('preview-simulation.html', acc); });
  } finally {
    ctx.draft('preview-simulation.html', null);
  }
  const html = stripCodeFence(reply).trim();
  if (!/<html[\s>]|<!doctype html/i.test(html)) throw new Error('الموديل ما رجّعش صفحة HTML صالحة للمحاكاة');
  ctx.patch((x) => { x.mock = { html, at: Date.now() }; });
  ctx.log('المحاكاة جاهزة', 'ok');
  return html;
}
