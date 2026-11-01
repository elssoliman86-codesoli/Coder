import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SSEDecoder, joinUrl, listModels, parseModels, probeModel, streamChat } from '../src/llm/client.ts';

const sse = (...deltas: string[]) =>
  deltas.map((d) => `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n\n`).join('') + 'data: [DONE]\n\n';

function streamResponse(body: string, chunk = 5): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(c) {
      for (let i = 0; i < body.length; i += chunk) c.enqueue(enc.encode(body.slice(i, i + chunk)));
      c.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

test('joinUrl', () => {
  assert.equal(joinUrl('https://x.com/v1/', '/models'), 'https://x.com/v1/models');
});

test('parseModels reads OpenRouter pricing per token → per 1M, context and max output', () => {
  const m = parseModels({
    data: [
      { id: 'b/free', context_length: 8192, pricing: { prompt: '0', completion: '0' } },
      { id: 'a/paid', context_length: 128000, pricing: { prompt: '0.000003', completion: '0.000015' }, top_provider: { max_completion_tokens: 4096 } },
      { id: 'plain' },
    ],
  });
  assert.deepEqual(m.map((x) => x.id), ['a/paid', 'b/free', 'plain']);
  assert.equal(m[0].inputPrice, 3);
  assert.equal(m[0].outputPrice, 15);
  assert.equal(m[0].context, 128000);
  assert.equal(m[0].maxOutput, 4096);
  assert.equal(m[1].inputPrice, 0);
  assert.equal(m[2].inputPrice, undefined, 'never guess missing prices');
  assert.equal(m[2].context, undefined);
});

test('parseModels handles Gemini-style names and plain arrays', () => {
  const m = parseModels({ models: [{ name: 'models/gemini-x', inputTokenLimit: 1000000, outputTokenLimit: 8192 }] });
  assert.equal(m[0].id, 'gemini-x');
  assert.equal(m[0].context, 1000000);
  assert.equal(m[0].maxOutput, 8192);
  assert.deepEqual(parseModels(['one', 'two']).map((x) => x.id), ['one', 'two']);
});

test('SSEDecoder reassembles events split at arbitrary points', () => {
  const body = sse('He', 'llo ', 'wörld');
  for (const size of [1, 3, 9, 50]) {
    const d = new SSEDecoder();
    let out = '';
    for (let i = 0; i < body.length; i += size) out += d.feed(body.slice(i, i + size));
    assert.equal(out, 'Hello wörld', `size ${size}`);
    assert.ok(d.done);
  }
});

test('listModels sends bearer auth and surfaces HTTP errors', async () => {
  let seen: any;
  const ok = await listModels({ baseUrl: 'https://p/v1', apiKey: 'k' }, {
    fetch: (async (url: string, init: any) => {
      seen = { url, auth: init.headers.authorization };
      return new Response(JSON.stringify({ data: [{ id: 'm1' }] }), { status: 200 });
    }) as any,
  });
  assert.equal(seen.url, 'https://p/v1/models');
  assert.equal(seen.auth, 'Bearer k');
  assert.equal(ok[0].id, 'm1');
  await assert.rejects(
    listModels({ baseUrl: 'https://p/v1', apiKey: 'bad' }, { fetch: (async () => new Response('{"error":{"message":"nope"}}', { status: 401 })) as any }),
    /401.*nope/,
  );
});

test('probeModel: 200 is ok, anything else carries its code', async () => {
  const mk = (status: number) => ({ fetch: (async () => new Response('{"error":{"message":"x"}}', { status })) as any });
  assert.deepEqual(await probeModel({ baseUrl: 'u', apiKey: '' }, 'm', mk(200)), { ok: true, code: 200 });
  const r = await probeModel({ baseUrl: 'u', apiKey: '' }, 'm', mk(404));
  assert.equal(r.ok, false);
  assert.equal(r.code, 404);
  const net = await probeModel({ baseUrl: 'u', apiKey: '' }, 'm', { fetch: (async () => { throw new Error('boom'); }) as any });
  assert.equal(net.code, 0);
});

test('streamChat streams tokens, retries 429 then succeeds', async () => {
  let calls = 0;
  const waits: number[] = [];
  const tokens: string[] = [];
  const text = await streamChat(
    { baseUrl: 'u', apiKey: 'k' },
    { model: 'm', messages: [{ role: 'user', content: 'x' }], onToken: (t) => tokens.push(t) },
    {
      fetch: (async () => {
        calls++;
        return calls === 1 ? new Response('{"error":{"message":"slow down"}}', { status: 429, headers: { 'retry-after': '2' } }) : streamResponse(sse('a', 'b', 'c'));
      }) as any,
      sleep: async (ms) => { waits.push(ms); },
    },
  );
  assert.equal(text, 'abc');
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2000]);
  assert.ok(tokens.length >= 1);
});

test('streamChat does not retry 401 and accepts non-stream JSON replies', async () => {
  let calls = 0;
  await assert.rejects(
    streamChat({ baseUrl: 'u', apiKey: '' }, { model: 'm', messages: [] }, { fetch: (async () => { calls++; return new Response('{"error":{"message":"bad key"}}', { status: 401 }); }) as any }),
    /401.*bad key/,
  );
  assert.equal(calls, 1);
  const t = await streamChat({ baseUrl: 'u', apiKey: '' }, { model: 'm', messages: [] }, {
    fetch: (async () => new Response(JSON.stringify({ choices: [{ message: { content: 'plain' } }] }), { status: 200, headers: { 'content-type': 'application/json' } })) as any,
  });
  assert.equal(t, 'plain');
});

test('streamChat honours abort', async () => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(streamChat({ baseUrl: 'u', apiKey: '' }, { model: 'm', messages: [], signal: ac.signal }, { fetch: (async () => new Response('')) as any }), /الإلغاء/);
});

import { flattenMessages } from '../src/llm/client';
test('flattenMessages folds system into the first user turn and alternates roles', () => {
  const out = flattenMessages([
    { role: 'system', content: 'S' }, { role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }, { role: 'user', content: 'd' },
  ]);
  assert.deepEqual(out.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(out[0].content, 'S\n\na');
  assert.equal(out[2].content, 'c\n\nd');
});

test('streamChat retries once with flattened messages after a roles-alternate 400', async () => {
  const bodies: any[] = [];
  const f = (async (_u: string, init: any) => {
    const b = JSON.parse(init.body); bodies.push(b);
    if (b.messages.some((m: any) => m.role === 'system')) return new Response(JSON.stringify({ error: { message: 'Conversation roles must alternate user/assistant/user/assistant/...' } }), { status: 400 });
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  const out = await streamChat({ baseUrl: 'http://x/v1', apiKey: '' }, { model: 'm-flat', messages: [{ role: 'system', content: 'S' }, { role: 'user', content: 'hi' }] }, { fetch: f, sleep: async () => undefined });
  assert.equal(out, 'ok');
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[1].messages.map((m: any) => m.role), ['user']);
});

import { raceAbort } from '../src/llm/http.ts';
import { streamChat as _stream } from '../src/llm/client.ts';

test('raceAbort rejects at once when the signal aborts, even if the operation never settles', async () => {
  const ac = new AbortController();
  const p = raceAbort(new Promise<never>(() => {}), ac.signal);
  setTimeout(() => ac.abort(), 10);
  await assert.rejects(p);
});

test('streamChat stops immediately on abort while the request hangs (native HTTP cannot be cancelled)', async () => {
  const ac = new AbortController();
  const hang = (() => new Promise<Response>(() => {})) as unknown as typeof fetch;
  const p = _stream({ baseUrl: 'http://x/v1', apiKey: 'k' }, { model: 'm', messages: [], signal: ac.signal }, { fetch: hang });
  setTimeout(() => ac.abort(), 10);
  const t0 = Date.now();
  await assert.rejects(p);
  assert.ok(Date.now() - t0 < 1000);
});

import { StreamInterrupted } from '../src/llm/client.ts';

test('a connection drop mid-stream keeps the text that arrived instead of restarting (no duplicated content)', async () => {
  const enc = new TextEncoder();
  let calls = 0;
  const f = (async () => {
    calls++;
    let n = 0;
    const body = new ReadableStream({
      pull(c) {
        if (n++ === 0) c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}]}\n\n'));
        else c.error(new TypeError('network lost'));
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
  let seen = '';
  await assert.rejects(
    _stream({ baseUrl: 'http://x/v1', apiKey: 'k' }, { model: 'm', messages: [], onToken: (t) => { seen += t; } }, { fetch: f, sleep: async () => {} }),
    (e: unknown) => e instanceof StreamInterrupted && e.partial === 'hello world',
  );
  assert.equal(calls, 1);
  assert.equal(seen, 'hello world');
});

import { parseSSEData } from '../src/llm/client.ts';
test('parseSSEData exposes reasoning text separately from the answer', () => {
  const r = parseSSEData('{"choices":[{"delta":{"reasoning_content":"thinking…","content":""}}]}');
  assert.equal(r.reasoning, 'thinking…');
  assert.equal(r.delta, '');
});

test('maxTotalMs caps a request that keeps streaming and keeps the partial text', async () => {
  const enc = new TextEncoder();
  const f = (async (_u: unknown, init?: RequestInit) => {
    const body = new ReadableStream({
      start(c) {
        const t = setInterval(() => { try { c.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"x"}}]}\n\n')); } catch { clearInterval(t); } }, 5);
        init?.signal?.addEventListener('abort', () => { clearInterval(t); try { c.error(new DOMException('Aborted', 'AbortError')); } catch { /* closed */ } });
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }) as unknown as typeof fetch;
  await assert.rejects(
    _stream({ baseUrl: 'http://x/v1', apiKey: 'k' }, { model: 'm', messages: [], maxTotalMs: 80 }, { fetch: f, sleep: async () => {} }),
    (e: unknown) => e instanceof StreamInterrupted && e.capped && e.partial.length > 0,
  );
});
