// Non-persisted runtime state: live drafts, activity log, running jobs.
import { useSyncExternalStore } from 'react';
import type { Project, QueueItem } from './types';
import type { RunCtx } from './agents/pipeline';
import { app, commitFile, createStore, patchProject } from './storage/store';
import { BUILTIN_SKILLS } from './skills/builtin';
import { Aborted, errMsg, uid } from './lib/util';
import type { Role, Skill } from './types';
import { explainHttpError, streamChat, type ChatMessage } from './llm/client';
import { applyEdit, continueFile, generateMock, generateProject, planProject } from './agents/pipeline';
import { stripCodeFence } from './agents/parse';

export interface LogLine {
  t: number;
  msg: string;
  kind: 'info' | 'ok' | 'warn' | 'error';
}

interface Runtime {
  drafts: Record<string, Record<string, string>>; // projectId → path → live text
  logs: Record<string, LogLine[]>;
  busy: Record<string, string | null>; // projectId → what is running
  following: Record<string, string | null>; // projectId → file currently being written
  /** Live proof that the model is working: when the job started, how much text arrived, and the tail of it. */
  progress: Record<string, { startedAt: number; lastAt: number; chars: number; tail: string } | undefined>;
}

export const runtime = createStore<Runtime>({ drafts: {}, logs: {}, busy: {}, following: {}, progress: {} });
const controllers = new Map<string, AbortController>();

export function useRuntime<T>(sel: (r: Runtime) => T): T {
  return useSyncExternalStore(runtime.subscribe, () => sel(runtime.get()));
}

export function allSkills(): Skill[] {
  const s = app.get();
  const builtin = BUILTIN_SKILLS.map((k) => ({ ...k, enabled: !s.disabledSkills.includes(k.name) }));
  return [...builtin, ...s.userSkills];
}

export function resolveEndpoint(role: Role): { baseUrl: string; apiKey: string; model: string } {
  const s = app.get();
  const ref = s.roles[role] ?? s.roles.coder ?? s.roles.planner;
  const provider = (ref && s.providers.find((p) => p.id === ref.providerId)) ?? s.providers.find((p) => p.isDefault) ?? s.providers[0];
  const model = ref?.modelId ?? provider?.models.find((m) => m.starred)?.id ?? provider?.models[0]?.id;
  if (!provider || !model) throw new Error('اضبط مزود الموديل واختار موديل من الإعدادات أولًا');
  return { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model };
}

export function log(id: string, msg: string, kind: LogLine['kind'] = 'info') {
  runtime.set((r) => ({ ...r, logs: { ...r.logs, [id]: [...(r.logs[id] ?? []).slice(-199), { t: Date.now(), msg, kind }] } }));
}

// Streaming can deliver hundreds of tokens a second. The store is updated at most once per ~16ms (a frame) with the full
// latest text, so every character is shown and the UI never falls behind or janks.
const pendingDraft = new Map<string, { id: string; path: string; text: string }>();
let draftTimer: ReturnType<typeof setTimeout> | null = null;
const draftStart = new Map<string, number>();
const MIN_LIVE_MS = 150; // even a very fast model's file is visible as "live" long enough to see it
function setDraft(id: string, path: string, text: string | null) {
  const key = id + '\0' + path;
  if (text === null) {
    pendingDraft.delete(key);
    const wait = MIN_LIVE_MS - (Date.now() - (draftStart.get(key) ?? 0));
    draftStart.delete(key);
    if (wait > 0 && app.get().projects[id]) setTimeout(() => { if (!draftStart.has(key)) applyDraft(id, path, null); }, wait);
    else applyDraft(id, path, null);
    return;
  }
  if (!draftStart.has(key)) { draftStart.set(key, Date.now()); applyDraft(id, path, text); return; }
  pendingDraft.set(key, { id, path, text });
  if (!draftTimer) draftTimer = setTimeout(flushDrafts, 16);
}
function flushDrafts() {
  draftTimer = null;
  const items = [...pendingDraft.values()];
  pendingDraft.clear();
  for (const d of items) applyDraft(d.id, d.path, d.text);
}
function applyDraft(id: string, path: string, text: string | null) {
  runtime.set((r) => {
    const d = { ...(r.drafts[id] ?? {}) };
    if (text === null) delete d[path];
    else d[path] = text;
    return { ...r, drafts: { ...r.drafts, [id]: d }, following: { ...r.following, [id]: text === null ? (r.following[id] === path ? null : r.following[id]) : path } };
  });
}

// ---- crash/disconnect safety: everything the model has written so far is kept, not just finished files ----
const lastDraft = new Map<string, Map<string, string>>();
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
const NOT_RECOVERABLE = (p: string) => p === 'PLAN.json' || p === 'preview-simulation.html';

function trackDraft(id: string, path: string, text: string | null) {
  if (text === null || NOT_RECOVERABLE(path)) return;
  let m = lastDraft.get(id);
  if (!m) lastDraft.set(id, (m = new Map()));
  m.set(path, text);
  if (!persistTimers.has(id)) persistTimers.set(id, setTimeout(() => { persistTimers.delete(id); persistRecovery(id); }, 1500));
}

function persistRecovery(id: string) {
  const m = lastDraft.get(id);
  if (!m || !app.get().projects[id]) return;
  const entries = [...m].filter(([, t]) => t.length > 0);
  if (!entries.length) return;
  patchProject(id, (p) => { p.recovery = { ...(p.recovery ?? {}), ...Object.fromEntries(entries) }; });
}

function dropRecovery(id: string, path: string) {
  if (!app.get().projects[id]?.recovery?.[path]) return;
  patchProject(id, (p) => { if (p.recovery) { delete p.recovery[path]; if (!Object.keys(p.recovery).length) delete p.recovery; } });
}

export function discardRecovery(id: string, path?: string) {
  if (path) { dropRecovery(id, path); return; }
  patchProject(id, (p) => { delete p.recovery; });
}

/** Save what arrived as the file's content as-is (the person decides it is good enough). */
export function acceptRecovery(id: string, path: string) {
  const t = app.get().projects[id]?.recovery?.[path];
  if (t === undefined) return;
  commitFile(id, path, stripCodeFence(t).replace(/\s+$/, '') + '\n');
  dropRecovery(id, path);
}

/** Ask the model to continue a cut-off file from the exact next character. */
export async function resumeRecovery(id: string, path: string) {
  await runJob(id, 'edit', async (ctx) => {
    const partial = ctx.getProject().recovery?.[path];
    if (partial === undefined) return;
    ctx.log(`بيكمّل ${path} من حيث وقف (${partial.length} حرف محفوظين)…`);
    const full = await continueFile(ctx, path, partial);
    ctx.commitFile(path, stripCodeFence(full).replace(/\s+$/, '') + '\n');
    ctx.log(`اكتمل ${path}`, 'ok');
  });
}

export function makeCtx(id: string, signal: AbortSignal): RunCtx {
  return {
    signal,
    skills: allSkills(),
    live: true,
    getProject: () => app.get().projects[id],
    patch: (fn) => patchProject(id, fn),
    commitFile: (path, content) => { lastDraft.get(id)?.delete(path); commitFile(id, path, content); dropRecovery(id, path); },
    draft: (path, text) => { setDraft(id, path, text); trackDraft(id, path, text); },
    log: (m, k) => log(id, m, k),
    chat: (role: Role, messages: ChatMessage[], onToken) => {
      const ep = resolveEndpoint(role);
      const st = app.get().settings;
      log(id, `بيكلّم الموديل (${role}): ${ep.model}…`);
      const onTok = (t: string) => {
        const now = Date.now();
        runtime.set((r) => {
          const pr = r.progress[id];
          return pr ? { ...r, progress: { ...r.progress, [id]: { ...pr, lastAt: now, chars: pr.chars + t.length, tail: (pr.tail + t).slice(-160) } } } : r;
        });
        onToken?.(t);
      };
      return streamChat(ep, { model: ep.model, messages, signal, onToken: onTok, temperature: role === 'planner' ? Math.min(1, st.temperature + 0.1) : st.temperature, maxTokens: st.maxOutputTokens || undefined, idleTimeoutMs: Math.max(20, st.requestTimeoutSec) * 1000 }).catch((e) => { throw explainHttpError(e, ep.model); });
    },
  };
}

function setBusy(id: string, what: string | null) {
  runtime.set((r) => ({ ...r, busy: { ...r.busy, [id]: what }, progress: { ...r.progress, [id]: what ? { startedAt: Date.now(), lastAt: Date.now(), chars: 0, tail: '' } : undefined } }));
}

export function isBusy(id: string): boolean {
  return !!runtime.get().busy[id];
}

export function cancel(id: string) {
  controllers.get(id)?.abort();
}

/** Runs a long job for a project with a shared abort controller, busy flag and error logging. */
export async function runJob<T>(id: string, what: string, job: (ctx: RunCtx) => Promise<T>): Promise<T | undefined> {
  if (isBusy(id)) throw new Error('فيه عملية شغّالة بالفعل على المشروع ده');
  const before = what === 'edit' || what === 'fix' ? app.get().projects[id]?.files : undefined;
  const ac = new AbortController();
  controllers.set(id, ac);
  setBusy(id, what);
  try {
    // Race against the abort signal so Stop frees the UI immediately even if something underneath cannot be cancelled.
    const aborted = new Promise<never>((_, rej) => ac.signal.addEventListener('abort', () => rej(new Aborted()), { once: true }));
    const work = job(makeCtx(id, ac.signal));
    work.catch(() => undefined);
    return await Promise.race([work, aborted]);
  } catch (e) {
    if (e instanceof Aborted || ac.signal.aborted) log(id, 'تم الإلغاء', 'warn');
    else {
      log(id, errMsg(e), 'error');
      patchProject(id, (p) => { if (p.status === 'planning' || p.status === 'coding') p.status = 'error'; });
    }
    return undefined;
  } finally {
    controllers.delete(id);
    setBusy(id, null);
    clearTimeout(persistTimers.get(id)); persistTimers.delete(id);
    flushDrafts();
    persistRecovery(id);
    lastDraft.delete(id);
    runtime.set((r) => ({ ...r, drafts: { ...r.drafts, [id]: {} }, following: { ...r.following, [id]: null } }));
    if (before) recordChange(id, before);
  }
}

const MAX_BASELINE_CHARS = 300_000;

/** Remember the pre-edit content of every file the job touched (only the first time, so the diff spans all pending changes). */
function recordChange(id: string, before: { path: string; content: string }[]) {
  const p = app.get().projects[id];
  if (!p) return;
  const old = new Map(before.map((f) => [f.path, f.content]));
  patchProject(id, (pr) => {
    const base = { ...(pr.baseline ?? {}) };
    for (const f of pr.files) {
      const b = old.get(f.path);
      if (b === f.content || f.path in base) continue;
      if ((b ?? '').length > MAX_BASELINE_CHARS) continue;
      base[f.path] = b === undefined ? null : b;
    }
    pr.baseline = base;
  });
}

export async function startProject(id: string) {
  await runJob(id, 'build', async (ctx) => {
    if (!ctx.getProject().plan) await planProject(ctx);
    await generateProject(ctx);
  });
}

/** Writes a plan for a project that already has files (e.g. a GitHub import) without touching the code. */
export async function makePlan(id: string) {
  const prev = app.get().projects[id];
  if (!prev) return;
  const keep = { status: prev.status === 'planning' || prev.status === 'coding' ? 'ready' as const : prev.status, type: prev.type, lang: prev.primaryLanguage, style: prev.style };
  await runJob(id, 'plan', async (ctx) => { await planProject(ctx); });
  patchProject(id, (p) => { p.status = keep.status === 'error' ? 'ready' : keep.status; p.type = keep.type; p.primaryLanguage = keep.lang; if (keep.style) p.style = keep.style; });
}

export async function generateMockPreview(id: string) {
  await runJob(id, 'mock', async (ctx) => { await generateMock(ctx); });
}

// ---------- edit queue ----------

export function enqueue(id: string, prompt: string) {
  const item: QueueItem = { id: uid('q'), prompt, status: 'queued', createdAt: Date.now(), filesTouched: [] };
  patchProject(id, (p) => { p.queue.push(item); });
  void processQueue(id);
}

export function updateQueue(id: string, itemId: string, fn: (q: QueueItem) => void) {
  patchProject(id, (p) => { const q = p.queue.find((x) => x.id === itemId); if (q) fn(q); });
}

export function moveQueue(id: string, itemId: string, dir: -1 | 1) {
  patchProject(id, (p) => {
    const i = p.queue.findIndex((x) => x.id === itemId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= p.queue.length) return;
    if (p.queue[i].status !== 'queued' || p.queue[j].status !== 'queued') return;
    [p.queue[i], p.queue[j]] = [p.queue[j], p.queue[i]];
  });
}

export function undoQueueItem(id: string, itemId: string) {
  patchProject(id, (p) => {
    const q = p.queue.find((x) => x.id === itemId);
    if (!q?.snapshot || q.undone) return;
    const touched = new Set(q.filesTouched);
    const snap = new Map(q.snapshot.map((f) => [f.path, f.content]));
    p.files = p.files.filter((f) => !touched.has(f.path) || snap.has(f.path)).map((f) => (touched.has(f.path) && snap.has(f.path) ? { ...f, content: snap.get(f.path)! } : f));
    q.undone = true;
  });
}

let draining = new Set<string>();

/** Runs queued items one at a time, in order. Safe to call repeatedly. */
export async function processQueue(id: string, onlyItem?: string) {
  if (draining.has(id)) return;
  draining.add(id);
  try {
    for (;;) {
      const p = app.get().projects[id];
      if (!p || isBusy(id)) break;
      const next = onlyItem ? p.queue.find((q) => q.id === onlyItem && q.status === 'queued') : p.queue.find((q) => q.status === 'queued');
      if (!next) break;
      const before = structuredClone(p.files);
      updateQueue(id, next.id, (q) => { q.status = 'running'; q.snapshot = before; });
      let ok = false;
      const changed = await runJob(id, 'edit', async (ctx) => {
        const c = await applyEdit(ctx, next.prompt, (i) => updateQueue(id, next.id, (q) => { q.understanding = i.understanding; q.satisfied = i.satisfied; q.missing = i.missing; }));
        ok = true;
        return c;
      });
      const cancelled = !ok && !app.get().projects[id]?.queue.find((q) => q.id === next.id && q.status !== 'running');
      updateQueue(id, next.id, (q) => {
        q.filesTouched = changed ?? [];
        q.status = ok ? 'done' : cancelled ? 'cancelled' : 'failed';
        if (!ok) q.error = runtime.get().logs[id]?.slice(-1)[0]?.msg;
      });
      if (onlyItem) break;
    }
  } finally {
    draining = new Set([...draining].filter((x) => x !== id));
  }
}

export function currentProject(id: string): Project | undefined {
  return app.get().projects[id];
}
