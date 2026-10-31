import type { ModelInfo } from '../types';
import { Aborted, sleep } from '../lib/util';
import { smartFetch } from './http';

export interface Endpoint {
  baseUrl: string;
  apiKey: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  /** Max silence (ms) between stream chunks before giving up. */
  idleTimeoutMs?: number;
}

export interface Deps {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}

function headers(ep: Endpoint): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (ep.apiKey) h.authorization = `Bearer ${ep.apiKey}`;
  return h;
}

async function errorText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    try {
      const j = JSON.parse(t);
      return j?.error?.message ?? j?.message ?? t.slice(0, 300);
    } catch {
      return t.slice(0, 300);
    }
  } catch {
    return res.statusText;
  }
}

const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Converts a "price per token" value (OpenRouter style) to USD per 1M tokens. */
const perMillion = (v: unknown): number | undefined => {
  const n = num(v);
  return n === undefined ? undefined : Math.round(n * 1e6 * 1e6) / 1e6;
};

/** Reads the model list from many OpenAI-compatible shapes. Missing values stay undefined, never guessed. */
export function parseModels(json: any): ModelInfo[] {
  const raw: any[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
  const out: ModelInfo[] = [];
  for (const m of raw) {
    const id: unknown = typeof m === 'string' ? m : m?.id ?? m?.name;
    if (typeof id !== 'string' || !id) continue;
    const idClean = id.replace(/^models\//, '');
    out.push({
      id: idClean,
      inputPrice: perMillion(m?.pricing?.prompt ?? m?.pricing?.input),
      outputPrice: perMillion(m?.pricing?.completion ?? m?.pricing?.output),
      context: num(m?.context_length ?? m?.context_window ?? m?.inputTokenLimit ?? m?.input_token_limit ?? m?.max_context_length),
      maxOutput: num(m?.top_provider?.max_completion_tokens ?? m?.max_output_tokens ?? m?.outputTokenLimit ?? m?.output_token_limit ?? m?.max_completion_tokens),
      status: 'untested',
    });
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

export async function listModels(ep: Endpoint, deps: Deps = {}, signal?: AbortSignal): Promise<ModelInfo[]> {
  const f = deps.fetch ?? smartFetch;
  const res = await f(joinUrl(ep.baseUrl, 'models'), { headers: headers(ep), signal });
  if (!res.ok) throw new HttpError(res.status, `تعذر جلب الموديلات (${res.status}): ${await errorText(res)}`);
  return parseModels(await res.json());
}

export interface ProbeResult {
  ok: boolean;
  code: number;
  error?: string;
}

/** A one-token chat completion. `ok` is true only for HTTP 200. */
export async function probeModel(ep: Endpoint, model: string, deps: Deps = {}, signal?: AbortSignal): Promise<ProbeResult> {
  const f = deps.fetch ?? smartFetch;
  try {
    const res = await f(joinUrl(ep.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: headers(ep),
      signal,
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1, stream: false }),
    });
    if (res.status === 200) return { ok: true, code: 200 };
    return { ok: false, code: res.status, error: await errorText(res) };
  } catch (e) {
    if (signal?.aborted) throw new Aborted();
    return { ok: false, code: 0, error: e instanceof Error ? e.message : 'network error' };
  }
}

/** Parses one SSE event payload (the text after "data:"). Returns the content delta, or null when finished. */
export function parseSSEData(data: string): { delta: string; done: boolean } {
  const d = data.trim();
  if (d === '[DONE]') return { delta: '', done: true };
  try {
    const j = JSON.parse(d);
    const choice = j?.choices?.[0];
    const delta: unknown = choice?.delta?.content ?? choice?.text ?? '';
    return { delta: typeof delta === 'string' ? delta : '', done: false };
  } catch {
    return { delta: '', done: false };
  }
}

/** Incremental SSE line buffer: feed text chunks, get content deltas. */
export class SSEDecoder {
  private buf = '';
  done = false;
  feed(chunk: string): string {
    this.buf += chunk;
    let out = '';
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const r = parseSSEData(line.slice(5));
      if (r.done) this.done = true;
      out += r.delta;
    }
    return out;
  }
}

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function streamChat(ep: Endpoint, opts: ChatOptions, deps: Deps = {}): Promise<string> {
  const f = deps.fetch ?? smartFetch;
  const wait = deps.sleep ?? sleep;
  const maxAttempts = 4;
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (opts.signal?.aborted) throw new Aborted();
    const idle = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => idle.abort(), opts.idleTimeoutMs ?? 180_000);
    };
    const onAbort = () => idle.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      arm();
      const res = await f(joinUrl(ep.baseUrl, 'chat/completions'), {
        method: 'POST',
        headers: headers(ep),
        signal: idle.signal,
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.2,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
          stream: true,
        }),
      });
      if (!res.ok) {
        const err = new HttpError(res.status, `فشل الطلب (${res.status}): ${await errorText(res)}`);
        if (RETRYABLE.has(res.status) && attempt < maxAttempts - 1) {
          lastErr = err;
          const ra = Number(res.headers.get('retry-after'));
          await wait(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : 800 * 2 ** attempt);
          continue;
        }
        throw err;
      }
      const ctype = res.headers.get('content-type') ?? '';
      let full = '';
      if (!res.body || !ctype.includes('text/event-stream')) {
        // Provider ignored stream:true — accept the plain JSON answer.
        const j = await res.json();
        full = j?.choices?.[0]?.message?.content ?? '';
        if (full) opts.onToken?.(full);
        return full;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      const sse = new SSEDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        arm();
        const text = sse.feed(dec.decode(value, { stream: true }));
        if (text) {
          full += text;
          opts.onToken?.(text);
        }
        if (sse.done) break;
      }
      return full;
    } catch (e) {
      if (opts.signal?.aborted) throw new Aborted();
      if (e instanceof HttpError) throw e;
      lastErr = idle.signal.aborted ? new Error('انتهت مهلة الاستجابة (لا بيانات من الموديل)') : e;
      if (attempt < maxAttempts - 1) {
        await wait(800 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('فشل الاتصال بالموديل');
}

export async function chat(ep: Endpoint, opts: Omit<ChatOptions, 'onToken'>, deps?: Deps): Promise<string> {
  return streamChat(ep, opts, deps);
}

export const PROVIDER_PRESETS: { id: string; label: string; baseUrl: string }[] = [
  { id: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'together', label: 'Together AI', baseUrl: 'https://api.together.xyz/v1' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'gemini', label: 'Google Gemini (OpenAI-compatible)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' },
  { id: 'ollama', label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1' },
  { id: 'custom', label: 'Custom', baseUrl: '' },
];
