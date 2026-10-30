import { del, get, set } from 'idb-keyval';
import { useStore } from '@app/store';

const SECRET_PREFIX = '2onebyte-provider-secret:';
const pendingWrites = new Map<string, Promise<void>>();

function serializeSecretOperation(providerId: string, operation: () => Promise<void>): Promise<void> {
  const previous = pendingWrites.get(providerId) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  pendingWrites.set(providerId, next);
  void next.finally(() => {
    if (pendingWrites.get(providerId) === next) pendingWrites.delete(providerId);
  }).catch(() => undefined);
  return next;
}

export function saveProviderSecret(providerId: string, apiKey: string): Promise<void> {
  const key = apiKey.trim();
  return serializeSecretOperation(providerId, async () => {
    if (key) await set(SECRET_PREFIX + providerId, key);
    else await del(SECRET_PREFIX + providerId);
  });
}

export function removeProviderSecret(providerId: string): Promise<void> {
  return serializeSecretOperation(providerId, () => del(SECRET_PREFIX + providerId));
}

export async function restoreProviderSecrets(): Promise<void> {
  const providers = useStore.getState().providers;
  const restored = await Promise.all(providers.map(async provider => {
    const apiKey = await get<string>(SECRET_PREFIX + provider.id);
    return { id: provider.id, apiKey: typeof apiKey === 'string' ? apiKey : '' };
  }));

  for (const item of restored) {
    useStore.getState().updateProvider(item.id, { apiKey: item.apiKey });
  }
}

export async function clearProviderSecrets(): Promise<void> {
  const providers = useStore.getState().providers;
  await Promise.all(providers.map(provider => removeProviderSecret(provider.id)));
}
