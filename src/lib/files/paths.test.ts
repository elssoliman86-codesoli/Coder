import { describe, expect, it } from 'vitest';
import { normalizeSafeProjectPath } from './paths';

describe('normalizeSafeProjectPath', () => {
  it('normalizes Windows separators and optional current-directory prefixes', () => {
    expect(normalizeSafeProjectPath('.\\src\\components\\App.tsx')).toBe('src/components/App.tsx');
  });

  it('rejects traversal and absolute paths', () => {
    expect(normalizeSafeProjectPath('../outside.txt')).toBeNull();
    expect(normalizeSafeProjectPath('src/../../outside.txt')).toBeNull();
    expect(normalizeSafeProjectPath('/etc/passwd')).toBeNull();
    expect(normalizeSafeProjectPath('C:\\Windows\\system.ini')).toBeNull();
  });

  it('rejects secret files, dependency folders, and repository metadata', () => {
    expect(normalizeSafeProjectPath('.env')).toBeNull();
    expect(normalizeSafeProjectPath('config/.env.production')).toBeNull();
    expect(normalizeSafeProjectPath('node_modules/pkg/index.js')).toBeNull();
    expect(normalizeSafeProjectPath('.git/config')).toBeNull();
  });

  it('rejects invalid and platform-reserved file names', () => {
    expect(normalizeSafeProjectPath('src/bad?.ts')).toBeNull();
    expect(normalizeSafeProjectPath('CON.txt')).toBeNull();
    expect(normalizeSafeProjectPath('src/trailing.')).toBeNull();
    expect(normalizeSafeProjectPath('a'.repeat(241))).toBeNull();
  });

  it('accepts ordinary nested project files', () => {
    expect(normalizeSafeProjectPath('src/features/home/Home.tsx')).toBe('src/features/home/Home.tsx');
  });
});
