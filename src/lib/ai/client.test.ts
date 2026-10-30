import { afterEach, describe, expect, it } from 'vitest';
import { useStore } from '@app/store';
import { resolveActiveModel } from './client';
import type { Model, Provider } from '@app/types';

function makeModel(providerId: string, id = 'test-model'): Model {
  return {
    id,
    name: id,
    providerId,
    status: 'untested',
    starred: false,
    assignedRoles: []
  };
}

function makeProvider(overrides: Partial<Provider> = {}): Provider {
  const id = overrides.id ?? 'provider-1';
  return {
    id,
    name: id,
    provider: 'openai',
    baseUrl: 'https://example.test/v1',
    apiKey: 'valid-test-key',
    models: [makeModel(id)],
    default: false,
    createdAt: 1,
    ...overrides
  };
}

afterEach(() => {
  useStore.setState({ providers: [] });
});

describe('resolveActiveModel', () => {
  it('returns null when there are no providers', () => {
    expect(resolveActiveModel()).toBeNull();
  });

  it('skips a default provider without credentials and uses the next ready provider', () => {
    const unavailable = makeProvider({ id: 'missing-key', apiKey: '', default: true });
    const ready = makeProvider({ id: 'ready', default: false });
    useStore.setState({ providers: [unavailable, ready] });

    expect(resolveActiveModel()).toEqual({
      provider: ready,
      model: ready.models[0]
    });
  });

  it('allows Ollama providers without an API key', () => {
    const ollama = makeProvider({ id: 'local', provider: 'ollama', apiKey: '' });
    useStore.setState({ providers: [ollama] });

    expect(resolveActiveModel()).toEqual({
      provider: ollama,
      model: ollama.models[0]
    });
  });

  it('prefers the selected model belonging to the default provider', () => {
    const first = makeModel('default-provider', 'first');
    const selected = makeModel('default-provider', 'selected');
    const preferred = makeProvider({
      id: 'default-provider',
      default: true,
      models: [first, selected],
      selectedModelId: 'selected'
    });
    const secondary = makeProvider({ id: 'secondary' });
    useStore.setState({ providers: [secondary, preferred] });

    expect(resolveActiveModel()).toEqual({ provider: preferred, model: selected });
  });

  it('does not return a model linked to a different provider', () => {
    const provider = makeProvider({
      id: 'provider-1',
      models: [makeModel('some-other-provider')]
    });
    useStore.setState({ providers: [provider] });

    expect(resolveActiveModel()).toBeNull();
  });
});
