import { useSyncExternalStore } from 'react';
import { DEFAULT_STATE, type AppState, type Project } from '../types';
import { decryptSecret, encryptSecret, generateKey } from '../lib/secrets';

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(fn: (s: T) => T) {
      state = fn(state);
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => { listeners.delete(l); };
    },
  };
}

export const app = createStore<AppState>(structuredClone(DEFAULT_STATE));
export const loaded = createStore(false);

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(app.subscribe, () => selector(app.get()));
}
export function useLoaded(): boolean {
  return useSyncExternalStore(loaded.subscribe, loaded.get);
}

// ---------- IndexedDB persistence ----------

const DB = 'onebyte-coder';
const KV = 'kv';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(KV);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const r = db.transaction(KV).objectStore(KV).get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
async function kvSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV, 'readwrite');
    tx.objectStore(KV).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

let cryptoKey: CryptoKey | null = null;
async function getKey(): Promise<CryptoKey> {
  if (cryptoKey) return cryptoKey;
  let k = await kvGet<CryptoKey>('device-key');
  if (!k) {
    k = await generateKey();
    await kvSet('device-key', k);
  }
  cryptoKey = k;
  return k;
}

async function seal(state: AppState): Promise<AppState> {
  const key = await getKey();
  const copy = structuredClone(state);
  for (const p of copy.providers) p.apiKey = await encryptSecret(p.apiKey, key);
  copy.github.token = await encryptSecret(copy.github.token, key);
  return copy;
}

async function unseal(state: AppState): Promise<AppState> {
  const key = await getKey();
  for (const p of state.providers) p.apiKey = await decryptSecret(p.apiKey, key).catch(() => '');
  state.github.token = await decryptSecret(state.github.token, key).catch(() => '');
  return state;
}

export async function loadState(): Promise<void> {
  try {
    const saved = await kvGet<AppState>('state');
    if (saved) {
      const merged: AppState = { ...structuredClone(DEFAULT_STATE), ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings }, github: { ...DEFAULT_STATE.github, ...saved.github, plugins: { ...DEFAULT_STATE.github.plugins, ...saved.github?.plugins } } };
      // Anything left "running" when the app closed is not running any more.
      for (const p of Object.values(merged.projects)) {
        for (const q of p.queue) if (q.status === 'running') q.status = 'queued';
        if (p.status === 'planning') p.status = 'new';
      }
      app.set(() => merged);
      await unseal(app.get());
      app.set((s) => ({ ...s }));
    }
  } catch (e) {
    console.warn('تعذر تحميل البيانات المحفوظة', e);
  }
  loaded.set(() => true);
}

let timer: ReturnType<typeof setTimeout> | undefined;
export function startPersisting() {
  app.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await kvSet('state', await seal(app.get()));
      } catch (e) {
        console.warn('تعذر حفظ البيانات', e);
      }
    }, 400);
  });
}

// ---------- actions ----------

export function setState(fn: (s: AppState) => void) {
  app.set((s) => {
    const next = { ...s };
    fn(next);
    return next;
  });
}

export function patchProject(id: string, fn: (p: Project) => void) {
  app.set((s) => {
    const cur = s.projects[id];
    if (!cur) return s;
    const next = structuredClone(cur);
    fn(next);
    next.updatedAt = Date.now();
    return { ...s, projects: { ...s.projects, [id]: next } };
  });
}

export function commitFile(id: string, path: string, content: string) {
  patchProject(id, (p) => {
    const f = p.files.find((x) => x.path === path);
    if (f) f.content = content;
    else p.files.push({ path, content });
  });
}

/** The person saved a file (or published): its old copy is no longer kept. */
export function acceptChanges(id: string, path?: string) {
  patchProject(id, (p) => {
    if (!p.baseline) return;
    if (!path) { delete p.baseline; return; }
    delete p.baseline[path];
    if (Object.keys(p.baseline).length === 0) delete p.baseline;
  });
}

export function deleteProject(id: string) {
  app.set((s) => {
    const projects = { ...s.projects };
    delete projects[id];
    return { ...s, projects };
  });
}
