import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGithubUrl, parseFrontMatter, importSkillsFromGithub } from '../src/skills/github.ts';
import { deriveTriggers, selectSkills, skillsPrompt } from '../src/skills/router.ts';
import { checkSkill, verdictOf } from '../src/skills/check.ts';
import type { Skill } from '../src/types.ts';

test('parseGithubUrl understands repo, tree/branch/path and short forms', () => {
  assert.deepEqual(parseGithubUrl('https://github.com/a/b'), { owner: 'a', repo: 'b', ref: undefined, path: '' });
  assert.deepEqual(parseGithubUrl('https://github.com/a/b.git'), { owner: 'a', repo: 'b', ref: undefined, path: '' });
  assert.deepEqual(parseGithubUrl('https://github.com/a/b/tree/main/skills/pdf'), { owner: 'a', repo: 'b', ref: 'main', path: 'skills/pdf' });
  assert.deepEqual(parseGithubUrl('a/b'), { owner: 'a', repo: 'b', ref: undefined, path: '' });
  assert.equal(parseGithubUrl('not a url'), null);
});

test('parseFrontMatter reads quoted and folded values', () => {
  const r = parseFrontMatter('---\nname: pdf-tools\ndescription: >\n  Work with PDF files.\n  Extract text.\nlicense: "MIT"\n---\n# Body\nhello');
  assert.equal(r.meta.name, 'pdf-tools');
  assert.equal(r.meta.description, 'Work with PDF files. Extract text.');
  assert.equal(r.meta.license, 'MIT');
  assert.equal(r.body, '# Body\nhello');
});

test('importSkillsFromGithub turns every SKILL.md folder into a skill with its own files', async () => {
  const blobs: Record<string, string> = {
    s1: '---\nname: pdf-tools\ndescription: Extract text and tables from PDF documents\n---\nUse pdfplumber.',
    s2: 'reference notes',
    s3: '---\nname: brand\ndescription: Apply brand colours to slides\n---\nUse the palette.',
    s4: 'print(1)',
  };
  const gh: any = {
    defaultBranch: async () => 'main',
    getTree: async () => ({ sha: 'x', truncated: false, tree: [
      { path: 'skills/pdf/SKILL.md', type: 'blob', sha: 's1', size: 90 },
      { path: 'skills/pdf/reference.md', type: 'blob', sha: 's2', size: 10 },
      { path: 'skills/pdf/scripts/run.py', type: 'blob', sha: 's4', size: 8 },
      { path: 'skills/brand/SKILL.md', type: 'blob', sha: 's3', size: 80 },
      { path: 'README.md', type: 'blob', sha: 's2', size: 10 },
    ] }),
    getBlob: async (_o: string, _r: string, sha: string) => new TextEncoder().encode(blobs[sha]),
  };
  const r = await importSkillsFromGithub(gh, 'https://github.com/acme/skills');
  assert.equal(r.skills.length, 2);
  const pdf = r.skills.find((s) => s.name === 'pdf-tools')!;
  assert.equal(pdf.folder, 'acme/skills');
  assert.deepEqual(pdf.files!.map((f) => f.path), ['reference.md', 'scripts/run.py']);
  assert.ok(pdf.triggers.includes('pdf') && pdf.triggers.includes('tables'));
  assert.equal(pdf.body, 'Use pdfplumber.');
});

test('imported skills with derived triggers are actually selected for a matching request, and not for others', () => {
  const s: Skill = { name: 'pdf-tools', description: 'Extract text and tables from PDF documents', appliesTo: ['*'], triggers: deriveTriggers('pdf-tools', 'Extract text and tables from PDF documents'), autoTriggers: true, always: false, enabled: true, builtin: false, body: 'Use pdfplumber.', files: [{ path: 'reference.md', content: 'REF-CONTENT' }] };
  assert.equal(selectSkills([s], 'a tool that reads PDF files', 'cli').length, 1);
  assert.equal(selectSkills([s], 'a todo list website', 'website').length, 0);
  const p = skillsPrompt([s]);
  assert.ok(p.includes('Use pdfplumber.') && p.includes('reference.md') && p.includes('REF-CONTENT'));
});

test('checkSkill compares with/without the skill and gives a verdict', async () => {
  const skill: Skill = { name: 'x', description: 'd', appliesTo: ['*'], triggers: [], always: false, enabled: true, builtin: false, body: 'Always start answers with ZZZ' };
  let judged = 0;
  const chat = async (m: { role: string; content: string }[]) => {
    const sys = m[0].content;
    if (sys.includes('design a small')) return JSON.stringify({ task: 'say hi', criteria: ['starts with ZZZ', 'is short'] });
    if (sys.includes('strict judge')) { judged++; const withSkill = judged === 1; return JSON.stringify({ results: [{ criterion: 'a', met: withSkill, evidence: 'e' }, { criterion: 'b', met: true, evidence: 'e' }] }); }
    return sys.includes('Skills you must follow') ? 'ZZZ hi' : 'hi';
  };
  const r = await checkSkill(chat as any, skill);
  assert.equal(r.withSkill.score, 1);
  assert.equal(r.withoutSkill.score, 0.5);
  assert.equal(r.verdict, 'effective');
  assert.equal(verdictOf(1, 1), 'neutral');
  assert.equal(verdictOf(0.4, 0.4), 'ineffective');
});
