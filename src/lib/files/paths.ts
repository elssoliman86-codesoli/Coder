const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const invalidCharacters = /[<>:"|?*\u0000-\u001f]/;

/**
 * Normalize a relative project path and reject paths unsafe for local filesystems.
 * This is a path-safety check, not a substitute for filesystem-level sandboxing.
 */
export function normalizeSafeProjectPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const path = value.trim().replace(/\\/g, '/').replace(/^(\.\/)+/, '');

  if (!path || path.length > 240 || path.startsWith('/') || /^[a-z]:/i.test(path)) return null;

  const parts = path.split('/');
  if (parts.some(part =>
    !part ||
    part === '.' ||
    part === '..' ||
    part.toLowerCase() === '.git' ||
    part.toLowerCase() === 'node_modules' ||
    /^\.env(?:\.|$)/i.test(part) ||
    invalidCharacters.test(part) ||
    /[. ]$/.test(part) ||
    reservedNames.test(part)
  )) return null;

  return path;
}
