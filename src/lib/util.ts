export function uid(prefix = ''): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return prefix + Array.from(r, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function slugify(s: string): string {
  const out = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return out || 'project';
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'خطأ غير معروف';
}

export function fmtNum(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'K';
  return String(n);
}

export function fmtPrice(p: number | undefined): string {
  if (p === undefined) return '—';
  if (p === 0) return 'مجاني';
  return '$' + (p < 0.01 ? p.toPrecision(2) : p.toFixed(2));
}

export class Aborted extends Error {
  constructor() {
    super('تم الإلغاء');
  }
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new Aborted();
}

/** Runs async jobs with a concurrency limit. Stops scheduling new jobs once the signal aborts. */
export async function pool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>, signal?: AbortSignal) {
  let i = 0;
  const run = async () => {
    while (i < items.length && !signal?.aborted) {
      const item = items[i++];
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
