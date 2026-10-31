import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlan, planToMarkdown } from '../src/agents/plan.ts';
import { analyzeProject, securityScan } from '../src/agents/analysis.ts';
import { shouldStop, mergeIssues, injectObserver } from '../src/agents/observer.ts';
import { capScore, passesGate, parseScore, validateCritic, buildDesignNotes, planProject, generateProject, applyEdit, runFixCycle, runExpert, type RunCtx } from '../src/agents/pipeline.ts';
import { fileBlock } from '../src/agents/parse.ts';
import { BUILTIN_SKILLS } from '../src/skills/builtin.ts';
import { parseSkillsMd, selectSkills, serializeSkills } from '../src/skills/router.ts';
import { lookupLocal, uiVocabulary } from '../src/ui-reference/lookup.ts';
import type { Project } from '../src/types.ts';

const goodPlan = {
  summary: 'متجر صغير', targetUsers: 'أصحاب محلات', type: 'website', primaryLanguage: 'javascript',
  stack: [{ category: 'language', choice: 'JavaScript', version: '1.0', reason: 'native' }],
  files: [{ path: 'index.html', purpose: 'entry' }, { path: 'style.css', purpose: 'styles' }, { path: 'app.js', purpose: 'logic' }],
  functions: [{ file: 'app.js', name: 'addItem', signature: 'addItem(x)', description: 'adds' }],
  screens: [{ name: 'Home', route: '/', uiTerms: ['Card'] }],
  design: { style: 'Minimalism', palette: { accent: '#3b82f6' }, typography: 'IBM Plex Sans Arabic', spacing: '8px', motion: '200ms' },
  tests: ['t'], risks: [], assumptions: ['a'], openQuestions: [],
};

test('validatePlan accepts a good plan and marks versions unverified', () => {
  const r = validatePlan(goodPlan);
  assert.deepEqual(r.errors, []);
  assert.equal(r.plan!.files.length, 3);
  assert.equal(r.plan!.stack[0].verified, false);
  assert.match(planToMarkdown('X', r.plan!), /index\.html/);
});

test('validatePlan reports specific, fixable errors', () => {
  assert.ok(validatePlan({ ...goodPlan, type: 'banana' }).errors[0].includes('type'));
  assert.ok(validatePlan({ ...goodPlan, files: [{ path: '../x', purpose: '' }] }).errors.some((e) => e.includes('غير صالح')));
  assert.ok(validatePlan({ ...goodPlan, files: [{ path: 'a.js', purpose: '' }] }).errors.some((e) => e.includes('index.html')));
  assert.ok(validatePlan({ ...goodPlan, functions: [{ file: 'nope.js', name: 'f' }] }).errors.some((e) => e.includes('nope.js')));
  assert.ok(validatePlan(null).errors.length > 0);
});

test('analyzeProject finds syntax errors, bad JSON, broken references and unbalanced CSS', () => {
  const f = analyzeProject([
    { path: 'index.html', content: '<link rel="stylesheet" href="style.css"><script src="missing.js"></script><a href="https://x.com">x</a>' },
    { path: 'style.css', content: 'a { color: red;' },
    { path: 'app.js', content: 'function x( { ' },
    { path: 'data.json', content: '{bad' },
    { path: 'ok.js', content: 'import a from "./b.js"; export const x = 1; const y = async () => { await 1 };' },
  ]);
  const msgs = f.map((x) => `${x.file}: ${x.message}`).join('\n');
  assert.match(msgs, /index\.html: مرجع لملف غير موجود: missing\.js/);
  assert.match(msgs, /style\.css: أقواس/);
  assert.match(msgs, /app\.js: خطأ صياغة/);
  assert.match(msgs, /data\.json: JSON غير صالح/);
  assert.ok(!msgs.includes('ok.js'), 'valid ES module must not be flagged');
  assert.ok(!msgs.includes('https://x.com'));
});

test('analyzeProject is clean on a valid project', () => {
  const f = analyzeProject([
    { path: 'index.html', content: '<link rel="stylesheet" href="css/s.css"><script src="./app.js"></script><script>var a=1;</script>' },
    { path: 'css/s.css', content: 'a{b:c}' },
    { path: 'app.js', content: 'console.log(1)' },
  ]);
  assert.deepEqual(f, []);
});

test('securityScan detects secrets, eval, innerHTML, risky manifests and sensitive files', () => {
  const f = securityScan(
    [
      { path: 'a.js', content: 'const t="ghp_' + 'a'.repeat(36) + '"; eval(x); el.innerHTML = user;' },
      { path: 'AndroidManifest.xml', content: '<application android:usesCleartextTraffic="true"/><uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>' },
      { path: '.env', content: 'A=1' },
      { path: 'safe.js', content: 'el.textContent = x; el.innerHTML = "<b>static</b>";' },
    ],
    'apk',
  );
  const has = (re: RegExp) => f.some((x) => re.test(x.message));
  assert.ok(has(/GitHub token/));
  assert.ok(has(/eval/));
  assert.ok(has(/innerHTML/));
  assert.ok(has(/usesCleartextTraffic/));
  assert.ok(has(/صلاحيات/));
  assert.ok(f.some((x) => x.file === '.env' && x.severity === 'critical'));
  assert.ok(!f.some((x) => x.file === 'safe.js' && /innerHTML/.test(x.message)), 'static innerHTML is fine');
});

test('fix loop stop conditions', () => {
  assert.equal(shouldStop([], 5), null);
  assert.equal(shouldStop([{ issuesBefore: 5, issuesAfter: 2 }], 5), null);
  assert.equal(shouldStop([{ issuesBefore: 5, issuesAfter: 6 }, { issuesBefore: 6, issuesAfter: 6 }], 5), 'no-progress');
  assert.equal(shouldStop([{ issuesBefore: 5, issuesAfter: 6 }, { issuesBefore: 6, issuesAfter: 3 }], 5), null);
  assert.equal(shouldStop(Array.from({ length: 5 }, (_, i) => ({ issuesBefore: 10 - i, issuesAfter: 9 - i })), 5), 'max-cycles');
});

test('mergeIssues dedups by shape, not by exact numbers', () => {
  const a = [{ type: 'contrast' as const, severity: 'high' as const, selector: 'p', message: 'تباين ضعيف 2.10:1' }];
  const m = mergeIssues(a, [{ ...a[0], message: 'تباين ضعيف 2.20:1' }, { type: 'overlap', severity: 'high', selector: 'x', message: 'm' }]);
  assert.equal(m.length, 2);
});

test('injectObserver puts the script in <head> and escapes </script>', () => {
  const out = injectObserver('<html><head><title>x</title></head><body></body></html>');
  assert.ok(out.indexOf('__audit') < out.indexOf('<title>'));
  assert.equal((out.match(/<\/script>/g) ?? []).length, 1);
  assert.ok(injectObserver('<p>x</p>').startsWith('<script>'));
});

test('quality gate: deterministic findings cap the score; only 10/10 with no blockers passes', () => {
  assert.equal(capScore(10, [], []), 10);
  assert.equal(capScore(10, [{ file: 'a', message: 'm', severity: 'critical' }], []), 3);
  assert.equal(capScore(10, [{ file: 'a', message: 'm', severity: 'high' }], []), 6);
  assert.equal(capScore(10, [], [{ file: 'a', message: 'm', severity: 'high' }]), 7);
  assert.equal(capScore(10, [{ file: 'a', message: 'm', severity: 'medium' }], []), 9);
  assert.equal(capScore(8.6, [], []), 9);
  assert.equal(passesGate({ score: 10, blockers: [] }), true);
  assert.equal(passesGate({ score: 10, blockers: ['x'] }), false);
  assert.equal(passesGate({ score: 9, blockers: [] }), false);
  const s = parseScore({ score: 99, criteria: { security: 'x', tests: 7 }, blockers: ['a', ''] });
  assert.equal(s.score, 10);
  assert.equal(s.criteria.tests, 7);
  assert.equal(s.criteria.security, 0);
  assert.deepEqual(s.blockers, ['a']);
});

test('validateCritic maps unknown files to a real one', () => {
  const r = validateCritic({ summary: 's', issues: [{ description: 'd', file: 'nope.css' }, { description: '' }] }, [{ path: 'style.css', content: '' }]);
  assert.equal(r.issues.length, 1);
  assert.equal(r.issues[0].file, 'style.css');
});

test('skills: router, skills.md round trip', () => {
  const web = selectSkills(BUILTIN_SKILLS, 'موقع متجر عربي', 'website', 'critic').map((s) => s.name);
  assert.ok(web.includes('visual-qa') && web.includes('ui-reference-namethatui') && web.includes('web-frontend-pro') && web.includes('arabic-rtl'));
  assert.ok(!web.includes('cli-pro') && !web.includes('security-audit'), 'role + type filters apply');
  const planner = selectSkills(BUILTIN_SKILLS, 'tool', 'any', 'planner').map((s) => s.name);
  assert.ok(planner.includes('requirements-understanding'));
  const cli = selectSkills(BUILTIN_SKILLS, 'a cli tool', 'cli', 'coder').map((s) => s.name);
  assert.ok(cli.includes('cli-pro') && !cli.includes('web-frontend-pro'));
  const parsed = parseSkillsMd(serializeSkills(BUILTIN_SKILLS));
  assert.equal(parsed.length, BUILTIN_SKILLS.length);
  assert.deepEqual(parsed[0].appliesTo, BUILTIN_SKILLS[0].appliesTo);
  assert.equal(parsed[0].body, BUILTIN_SKILLS[0].body);
  assert.ok(BUILTIN_SKILLS.length >= 17);
});

test('ui_lookup finds relevant terms offline and builds a vocabulary block', async () => {
  const r = lookupLocal('a dashboard with a hamburger side menu and cards, glass look');
  const names = r.terms.map((t) => t.name).join('|');
  assert.match(names, /Hamburger/);
  assert.match(names, /Card/);
  assert.match(names, /Bento/);
  assert.equal(r.style?.slug, 'glassmorphism');
  const v = await uiVocabulary('قائمة جانبية وكروت', { live: false });
  assert.match(v.text, /UI vocabulary/);
  assert.ok(v.terms.length > 0);
});

// ---------- pipeline with a scripted fake model ----------

function makeCtx(script: (role: string, messages: any[]) => string, init?: Partial<Project>) {
  let project: Project = {
    id: 'p1', name: 'Shop', description: 'موقع متجر عربي', type: 'website', primaryLanguage: 'html', files: [], status: 'new',
    style: '', queue: [], createdAt: 0, updatedAt: 0, reviewCycles: 0, ...init,
  } as Project;
  const logs: string[] = [];
  const drafts: Record<string, string[]> = {};
  const roles: string[] = [];
  const ctx: RunCtx = {
    signal: new AbortController().signal,
    skills: BUILTIN_SKILLS,
    getProject: () => project,
    patch: (fn) => { project = structuredClone(project); fn(project); },
    commitFile: (path, content) => {
      project = structuredClone(project);
      const f = project.files.find((x) => x.path === path);
      if (f) f.content = content; else project.files.push({ path, content });
    },
    draft: (path, text) => { if (text !== null) (drafts[path] ??= []).push(text); },
    log: (m) => logs.push(m),
    chat: async (role, messages, onToken) => {
      roles.push(role);
      const out = script(role, messages);
      if (onToken) for (let i = 0; i < out.length; i += 7) onToken(out.slice(i, i + 7));
      return out;
    },
  };
  return { ctx, get: () => project, logs, drafts, roles };
}

test('pipeline: plan → generate files live → edit → fix cycle', async () => {
  let planCalls = 0;
  let reviewCalls = 0;
  const t = makeCtx((role, messages) => {
    const user = messages[messages.length - 1].content as string;
    if (role === 'planner' && String(messages[0].content).includes('Plan Reviewer')) { reviewCalls++; return 'PLAN_OK'; }
    if (role === 'planner') {
      planCalls++;
      return planCalls === 1 ? '{"type":"banana"}' : '```json\n' + JSON.stringify(goodPlan) + '\n```';
    }
    if (role === 'coder' && user.includes('Change request:')) return fileBlock('app.js', 'function addItem(x){return x+1}\n') + '\n' + fileBlock('extra.js', 'var z=1');
    if (role === 'coder' && user.includes('Write the complete content of `index.html`')) return '```html\n<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><button>a</button><script src="app.js"></script></body></html>\n```';
    if (role === 'coder' && user.includes('`style.css`')) return 'button{padding:12px}';
    if (role === 'coder' && user.includes('`app.js`')) return 'function addItem(x){return x}';
    if (role === 'coder') return fileBlock('app.js', 'function addItem(x){return x+1}\n') + '\n' + fileBlock('extra.js', 'var z=1');
    if (role === 'critic') return JSON.stringify({ summary: 's', issues: [{ id: 'I1', element: 'button', file: 'style.css', type: 'spacing', severity: 'high', description: 'buttons touch', suggestion: 'gap' }] });
    if (role === 'fixer') return fileBlock('style.css', 'button{padding:12px;margin:8px}');
    return '';
  });
  const plan = await planProject(t.ctx);
  assert.equal(plan.files.length, 3);
  assert.equal(planCalls, 2, 'first invalid plan is retried with the errors');
  assert.equal(reviewCalls, 1, 'a valid plan is reviewed once');
  assert.equal(t.get().status, 'coding');

  await generateProject(t.ctx);
  const files = Object.fromEntries(t.get().files.map((f) => [f.path, f.content]));
  assert.ok(files['index.html'].startsWith('<!doctype html>'), 'code fence stripped');
  assert.equal(files['style.css'], 'button{padding:12px}\n');
  assert.ok(files['PLAN.md'] && files['design-notes.md'].includes('NameThatUI'));
  assert.equal(t.get().status, 'ready');
  assert.ok(t.drafts['style.css'].length >= 1, 'live drafts were streamed');

  const changed = await applyEdit(t.ctx, 'add a counter');
  assert.deepEqual(changed.sort(), ['app.js', 'extra.js']);
  assert.ok(t.get().plan!.files.some((f) => f.path === 'extra.js'));

  const r = await runFixCycle(t.ctx, { observed: [{ type: 'touching', severity: 'medium', selector: 'button', message: 'x' }] });
  assert.equal(r.critic.issues.length, 1);
  assert.deepEqual(r.fix!.changed, ['style.css']);
  assert.equal(t.get().reviewCycles, 1);
  assert.equal(t.get().files.find((f) => f.path === 'style.css')!.content, 'button{padding:12px;margin:8px}\n');
});

test('generateProject resumes: existing files are skipped', async () => {
  const t = makeCtx(() => 'x', { plan: validatePlan(goodPlan).plan!, status: 'coding', files: [{ path: 'index.html', content: '<p>done</p>' }] });
  await generateProject(t.ctx);
  assert.equal(t.roles.filter((r) => r === 'coder').length, 2);
  assert.equal(t.get().files.find((f) => f.path === 'index.html')!.content, '<p>done</p>');
});

test('buildDesignNotes lists the NameThatUI terms', () => {
  const n = buildDesignNotes(validatePlan(goodPlan).plan!, ['Toast (Snackbar)'], 'Minimalism');
  assert.match(n, /Toast \(Snackbar\)/);
  assert.match(n, /Card/);
});

test('expert: cleans, scores, and the gate holds until 10/10 with clean deterministic checks', async () => {
  let round = 0;
  const t = makeCtx((_role, messages) => {
    const sys = messages[0].content as string;
    if (sys.includes('scoring a project')) {
      round++;
      return JSON.stringify({ score: round >= 2 ? 10 : 7, criteria: {}, blockers: round >= 2 ? [] : ['add tests'], summary: 'ok' });
    }
    return round === 0 ? fileBlock('app.js', 'const a = 1;') : 'NO_CHANGES';
  }, { files: [{ path: 'index.html', content: '<p>x</p>' }, { path: 'app.js', content: 'var a=eval("1")' }], plan: validatePlan(goodPlan).plan! });
  const report = await runExpert(t.ctx);
  assert.equal(report.rounds, 2);
  assert.equal(report.passed, true);
  assert.equal(t.get().files.find((f) => f.path === 'app.js')!.content, 'const a = 1;\n');

  // A model that always says 10 cannot override a critical finding.
  const t2 = makeCtx((_role, messages) => ((messages[0].content as string).includes('scoring a project') ? JSON.stringify({ score: 10, criteria: {}, blockers: [], summary: '' }) : 'NO_CHANGES'),
    { files: [{ path: 'index.html', content: '<p>x</p>' }, { path: 'k.js', content: 'const t="ghp_' + 'b'.repeat(36) + '";' }], plan: validatePlan(goodPlan).plan! });
  const r2 = await runExpert(t2.ctx, 2);
  assert.equal(r2.passed, false);
  assert.ok(r2.score <= 3);
  assert.ok(r2.blockers.some((b) => b.includes('GitHub token')));
});

test('validatePlan: every code file must list its functions', () => {
  const bad = { ...goodPlan, functions: [] };
  const r = validatePlan(bad);
  assert.ok(r.errors.some((e) => e.includes('functions')), r.errors.join('|'));
});

test('planProject: reviewer can replace the plan with a fuller one', async () => {
  const fuller = { ...goodPlan, files: [...goodPlan.files, { path: 'extra.js', purpose: 'x' }], functions: [...goodPlan.functions, { file: 'extra.js', name: 'extra', signature: 'extra(): void', description: 'd' }] };
  const t = makeCtx((_role, messages) => (String(messages[0].content).includes('Plan Reviewer') ? JSON.stringify(fuller) : JSON.stringify(goodPlan)));
  const plan = await planProject(t.ctx);
  assert.equal(plan.files.length, goodPlan.files.length + 1);
});

// ---------- edit requests: understand → apply → review → repair ----------

function editCtx(script: (role: string, system: string, user: string) => string) {
  const files = [{ path: 'index.html', content: '<!doctype html><html><body><button id="a">A</button><script src="app.js"></script></body></html>' }, { path: 'app.js', content: 'document.getElementById("a").onclick = () => {};\n' }, { path: 'style.css', content: 'body{margin:0}' }];
  const calls: { role: string; user: string }[] = [];
  const t = makeCtx((role, messages) => {
    const system = String(messages[0].content); const user = String(messages[messages.length - 1].content);
    calls.push({ role, user });
    return script(role, system, user);
  }, { files, plan: validatePlan(goodPlan).plan!, status: 'ready' });
  return { ...t, calls };
}

test('applyEdit: understands the request, picks files, reviews, and reports', async () => {
  const infos: any[] = [];
  const t = editCtx((role, system, user) => {
    if (system.includes('Request Analyst')) return JSON.stringify({ understanding: 'ضيف زرار ثاني', files: ['index.html', 'nope.txt'], newFiles: [], acceptance: ['فيه زرار id=b'] });
    if (system.includes('Change Reviewer')) return JSON.stringify({ satisfied: true, missing: [] });
    if (role === 'coder') return fileBlock('index.html', '<!doctype html><html><body><button id="a">A</button><button id="b">B</button><script src="app.js"></script></body></html>');
    return '';
  });
  const changed = await applyEdit(t.ctx, 'ضيف زرار ثاني', (i) => infos.push(i));
  assert.deepEqual(changed, ['index.html']);
  const coder = t.calls.filter((c) => c.role === 'coder');
  assert.equal(coder.length, 1, 'no repair round when the review passes');
  assert.match(coder[0].user, /Understood as: ضيف زرار ثاني/);
  assert.match(coder[0].user, /فيه زرار id=b/);
  assert.ok(coder[0].user.includes('--- index.html ---'));
  assert.equal(infos[0].understanding, 'ضيف زرار ثاني');
  assert.equal(infos.at(-1).satisfied, true);
});

test('applyEdit: an unmet review triggers one repair round with the problems in the prompt', async () => {
  let n = 0;
  const t = editCtx((role, system) => {
    if (system.includes('Request Analyst')) return JSON.stringify({ understanding: 'u', files: ['app.js'], acceptance: [] });
    if (system.includes('Change Reviewer')) return n === 1 ? JSON.stringify({ satisfied: false, missing: ['app.js: الزرار b مالوش handler'] }) : JSON.stringify({ satisfied: true, missing: [] });
    if (role === 'coder') { n++; return fileBlock('app.js', n === 1 ? 'var x = 1;\n' : 'document.getElementById("b").onclick = () => {};\n'); }
    return '';
  });
  const infos: any[] = [];
  await applyEdit(t.ctx, 'اربط الزرار', (i) => infos.push(i));
  const coder = t.calls.filter((c) => c.role === 'coder');
  assert.equal(coder.length, 2);
  assert.match(coder[1].user, /reviewer found these problems/);
  assert.match(coder[1].user, /الزرار b مالوش handler/);
  assert.match(t.get().files.find((f) => f.path === 'app.js')!.content, /getElementById\("b"\)/);
  assert.equal(infos.at(-1).satisfied, true);
  assert.equal(infos.at(-1).rounds, 2);
});

test('applyEdit: a syntax error is caught by the deterministic check even if the reviewer is silent', async () => {
  let n = 0;
  const t = editCtx((role, system) => {
    if (system.includes('Request Analyst')) return 'not json';
    if (system.includes('Change Reviewer')) return 'looks fine';
    if (role === 'coder') { n++; return fileBlock('app.js', n === 1 ? 'function (' : 'var ok = 1;\n'); }
    return '';
  });
  await applyEdit(t.ctx, 'x');
  assert.equal(n, 2, 'repair round ran');
  assert.equal(t.get().files.find((f) => f.path === 'app.js')!.content, 'var ok = 1;\n');
});

test('runFixCycle: the user\'s note becomes a mandatory issue even when the critic finds nothing', async () => {
  const t = editCtx((role) => (role === 'critic' ? JSON.stringify({ summary: 'ok', issues: [] }) : role === 'fixer' ? fileBlock('style.css', 'body{margin:0;color:red}') : ''));
  const r = await runFixCycle(t.ctx, { observed: [], userCritique: 'خلي النص أحمر' });
  assert.equal(r.critic.issues[0].type, 'user-request');
  assert.ok(r.fix, 'the fixer ran');
  assert.match(t.get().files.find((f) => f.path === 'style.css')!.content, /red/);
});
