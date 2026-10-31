// Encrypts secrets (API keys, GitHub token) before they are persisted.
// The AES-GCM key is generated once per device and stored as a NON-EXTRACTABLE CryptoKey in IndexedDB,
// so the raw key bytes are never readable by JavaScript. This protects against casual reads of the stored
// data; it is not a hardware keystore (Android Keystore is not used by this build).

const PREFIX = 'enc1:';

function b64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string, key: CryptoKey): Promise<string> {
  if (!plain) return '';
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain));
  return PREFIX + b64(iv) + '.' + b64(new Uint8Array(buf));
}

export async function decryptSecret(stored: string, key: CryptoKey): Promise<string> {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // legacy plain value
  const [iv, data] = stored.slice(PREFIX.length).split('.');
  const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) as BufferSource }, key, unb64(data) as BufferSource);
  return new TextDecoder().decode(buf);
}

export function isEncrypted(s: string): boolean {
  return s.startsWith(PREFIX);
}
