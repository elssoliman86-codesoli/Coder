import { del, get, set } from 'idb-keyval';
import { useStore } from '@app/store';

const SECRET_PREFIX = '2onebyte-provider-secret:';

export async function saveProviderSecret(providerId: string, apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (key) await set(SECRET_PREFIX + providerId, key);
  else await del(SECRET_PREFIX + providerId);
}

export async function removeProviderSecret(providerId: string): Promise<void> {
  await del(SECRET_PREFIX + providerId);
}

export async function restoreProviderSecrets(): Promise<void> {
  const providers = useStore.getState().providers;
  await Promise.all(providers.map(async provider => {
    const apiKey = await get<string>(SECRET_PREFIX + provider.id);
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      useStore.getState().updateProvider(provider.id, { apiKey });
    }
  }));
}

export async function clearProviderSecrets(): Promise<void> {
  const providers = useStore.getState().providers;
  await Promise.all(providers.map(provider => del(SECRET_PREFIX + provider.id)));
}
