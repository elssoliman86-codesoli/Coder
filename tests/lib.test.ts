import { test } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { ImportError, importZip, safePath, exportZip } from '../src/lib/zip.ts';
import { detectProjectType, languageOf, primaryLanguage } from '../src/lib/lang.ts';
import { decryptSecret, encryptSecret, generateKey, isEncrypted } from '../src/lib/secrets.ts';
import { pool, fmtNum, fmtPrice } from '../src/lib/util.ts';

test('safePath rejects traversal and absolute paths', () => {
  assert.equal(safePath('a/b.txt'), 'a/b.txt');
  assert.equal(safePath('dir/'), null);
  assert.throws(() => safePath('../x'), ImportError);
  assert.throws(() => safePath('a/../../x'), ImportError);
  assert.throws(() => safePath('/etc/passwd'), ImportError);
  assert.throws(() => safePath('C:\\win\\x'), ImportError);
});

test('importZip strips the common root, skips node_modules/binaries', async () => {
  const z = new JSZip();
  z.file('Proj-main/index.html', '<h1>x</h1>');
  z.file('Proj-main/src/app.js', 'let a=1');
  z.file('Proj-main/node_modules/x/index.js', 'skip');
  z.file('Proj-main/logo.png', 'png');
  z.file('Proj-main/blob.dat', new Uint8Array([1, 0, 2, 0]));
  const r = await importZip(await z.generateAsync({ type: 'uint8array' }));
  assert.deepEqual(r.files.map((f) => f.path).sort(), ['index.html', 'src/app.js']);
  assert.equal(r.skipped.length, 3);
});

test('importZip never yields a path that escapes the project (JSZip also normalises ".." itself)', async () => {
  const z = new JSZip();
  z.file('ok.txt', 'ok');
  z.file('../evil.txt', 'bad');
  z.file('a/../../x/y.txt', 'bad');
  const r = await importZip(await z.generateAsync({ type: 'uint8array' }));
  for (const f of r.files) {
    assert.ok(!f.path.split('/').includes('..') && !f.path.startsWith('/'), f.path);
  }
});

test('importZip blocks zip bombs (total size limit)', async () => {
  const z = new JSZip();
  const big = 'a'.repeat(1.9 * 1024 * 1024);
  for (let i = 0; i < 25; i++) z.file(`f${i}.txt`, big);
  await assert.rejects(importZip(await z.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })), /zip bomb/);
});

test('exportZip → importZip round trip', async () => {
  const blob = await exportZip([{ path: 'a/b.py', content: 'print(1)' }, { path: 'index.html', content: 'x' }]);
  const r = await importZip(await blob.arrayBuffer());
  assert.deepEqual(r.files.sort((a, b) => a.path.localeCompare(b.path)), [{ path: 'a/b.py', content: 'print(1)' }, { path: 'index.html', content: 'x' }]);
});

test('language detection', () => {
  assert.equal(languageOf('src/main.py'), 'python');
  assert.equal(languageOf('Dockerfile'), 'shell');
  assert.equal(languageOf('x.unknown'), 'text');
  assert.equal(primaryLanguage(['a.py', 'b.py', 'c.js', 'README.md', 'x.json']), 'python');
  assert.equal(primaryLanguage(['index.html', 'style.css']), 'html');
  assert.equal(detectProjectType(['index.html', 'app.js']), 'website');
  assert.equal(detectProjectType(['android/app/src/main/AndroidManifest.xml']), 'apk');
  assert.equal(detectProjectType(['main.py']), 'cli');
});

test('secrets are encrypted at rest and round-trip', async () => {
  const key = await generateKey();
  const enc = await encryptSecret('sk-secret-123', key);
  assert.ok(isEncrypted(enc));
  assert.ok(!enc.includes('sk-secret'));
  assert.equal(await decryptSecret(enc, key), 'sk-secret-123');
  assert.equal(await encryptSecret('', key), '');
  assert.equal(await decryptSecret('legacy-plain', key), 'legacy-plain');
  const other = await generateKey();
  await assert.rejects(decryptSecret(enc, other));
});

test('pool respects the concurrency limit and abort', async () => {
  let active = 0;
  let peak = 0;
  await pool([1, 2, 3, 4, 5, 6], 2, async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
  });
  assert.equal(peak, 2);
  const ac = new AbortController();
  const ran: number[] = [];
  await pool([1, 2, 3, 4], 1, async (n) => { ran.push(n); if (n === 2) ac.abort(); }, ac.signal);
  assert.deepEqual(ran, [1, 2]);
});

test('formatters never invent values', () => {
  assert.equal(fmtNum(undefined), '—');
  assert.equal(fmtNum(128000), '128K');
  assert.equal(fmtNum(1_000_000), '1M');
  assert.equal(fmtPrice(undefined), '—');
  assert.equal(fmtPrice(0), 'مجاني');
  assert.equal(fmtPrice(3), '$3.00');
});

import { diffLines, diffStats } from '../src/lib/diff.ts';
import { analyzeProject as _ap } from '../src/agents/analysis.ts';

test('diffLines marks added/removed lines with numbers', () => {
  const d = diffLines('a\nb\nc', 'a\nB\nc\nd', 1);
  assert.deepEqual(d.filter((l) => l.kind === 'del').map((l) => l.text), ['b']);
  assert.deepEqual(d.filter((l) => l.kind === 'add').map((l) => l.text), ['B', 'd']);
  assert.deepEqual(diffStats('a\nb', 'a\nb'), { added: 0, removed: 0 });
  assert.deepEqual(diffStats('', 'x\ny'), { added: 2, removed: 0 });
});

test('analyzeProject does not flag public/ or build-output refs', () => {
  const html = '<link rel="manifest" href="manifest.webmanifest"><link href="/favicon.svg"><script src="assets/app.js"></script><link href="assets/app.css" rel="stylesheet">';
  const files = [
    { path: 'index.html', content: html },
    { path: 'public/manifest.webmanifest', content: '{}' },
    { path: 'public/favicon.svg', content: '<svg/>' },
    { path: 'package.json', content: '{"scripts":{"build":"x"}}' },
  ];
  assert.equal(_ap(files).filter((f) => f.message.includes('مرجع')).length, 0);
  const noBuild = _ap([{ path: 'index.html', content: '<script src="missing.js"></script>' }]);
  assert.equal(noBuild.filter((f) => f.message.includes('مرجع')).length, 1);
});
