import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FileStreamParser, extractJson, parseFileBlocks, stripCodeFence, fileBlock } from '../src/agents/parse.ts';

test('extractJson handles fences, chatter and nested braces in strings', () => {
  const v = extractJson('Sure!\n```json\n{"a":{"b":"}{"},"c":[1,2]}\n```\nbye') as any;
  assert.equal(v.a.b, '}{');
  assert.deepEqual(v.c, [1, 2]);
  assert.throws(() => extractJson('no json here'));
});

test('stripCodeFence', () => {
  assert.equal(stripCodeFence('```js\nlet a=1\n```'), 'let a=1');
  assert.equal(stripCodeFence('plain'), 'plain');
});

test('parseFileBlocks round-trips multiple files and rejects unsafe paths', () => {
  const text = [fileBlock('a.txt', 'one\ntwo'), 'chatter', fileBlock('src/b.js', 'x'), fileBlock('../evil', 'no')].join('\n');
  const files = parseFileBlocks(text);
  assert.deepEqual(files, [
    { path: 'a.txt', content: 'one\ntwo' },
    { path: 'src/b.js', content: 'x' },
  ]);
});

test('FileStreamParser gives the same result for any chunking', () => {
  const text = fileBlock('index.html', '<h1>hi</h1>\n\n<p>x</p>\n') + '\n' + fileBlock('s.css', 'a{b:c}');
  const expected = parseFileBlocks(text);
  for (const size of [1, 2, 3, 7, 13, 1000]) {
    const p = new FileStreamParser();
    for (let i = 0; i < text.length; i += size) p.feed(text.slice(i, i + size));
    p.end();
    assert.deepEqual([...p.files.entries()].map(([path, content]) => ({ path, content })), expected, `chunk size ${size}`);
  }
  assert.equal(expected[0].content, '<h1>hi</h1>\n\n<p>x</p>\n');
});

test('FileStreamParser emits live chunks before the line is finished', () => {
  const chunks: string[] = [];
  const p = new FileStreamParser({ onChunk: (_p, t) => chunks.push(t) });
  p.feed('=====FILE: a.js=====\nconst x');
  assert.ok(chunks.join('').includes('const x'));
  p.feed(' = 1;\n=====END FILE=====');
  p.end();
  assert.equal(p.files.get('a.js'), 'const x = 1;');
});

test('content lines that start with "=" are not lost', () => {
  const text = fileBlock('a.md', 'Title\n=====\ntext');
  assert.equal(parseFileBlocks(text)[0].content, 'Title\n=====\ntext');
});
