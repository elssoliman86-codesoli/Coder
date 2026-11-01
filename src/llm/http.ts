// fetch with a native fallback for the Android app.
// Inside the Capacitor WebView, `fetch` is subject to CORS. Many OpenAI-compatible providers send no CORS headers,
// which shows up as an unexplained "Failed to fetch". When that happens on a native platform we retry once through
// Capacitor's native HTTP stack (no CORS). That path cannot stream, so the request is sent with stream:false and the
// full answer comes back as one JSON body (streamChat already accepts that).

interface NativeHttp {
  request(o: { url: string; method: string; headers?: Record<string, string>; data?: unknown; responseType?: string; readTimeout?: number; connectTimeout?: number }): Promise<{ status: number; data: unknown; headers: Record<string, string> }>;
}

function nativeHttp(): NativeHttp | null {
  const cap = (globalThis as any).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return (cap.Plugins?.CapacitorHttp as NativeHttp | undefined) ?? null;
}

/** Rejects as soon as the signal aborts, even if the underlying operation (e.g. a native HTTP call) cannot be cancelled. */
export function raceAbort<T>(p: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return p;
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const on = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', on, { once: true });
    p.then((v) => { signal.removeEventListener('abort', on); resolve(v); }, (e) => { signal.removeEventListener('abort', on); reject(e); });
  });
}

export const smartFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch (e) {
    if (init?.signal?.aborted) throw e;
    const http = nativeHttp();
    if (!http) throw e;
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => { headers[k] = v; });
    let data: unknown;
    if (typeof init?.body === 'string') {
      try { data = JSON.parse(init.body); if (data && typeof data === 'object' && 'stream' in (data as object)) (data as Record<string, unknown>).stream = false; } catch { data = init.body; }
    }
    const r = await raceAbort(http.request({ url, method: init?.method ?? 'GET', headers, data, responseType: 'json', readTimeout: 300_000, connectTimeout: 30_000 }), init?.signal ?? undefined);
    const body = typeof r.data === 'string' ? r.data : JSON.stringify(r.data ?? null);
    return new Response(body, { status: r.status, headers: { 'content-type': 'application/json' } });
  }
};
