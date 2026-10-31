// Tiny OpenAI-compatible mock used by the e2e test. It plays every agent role:
// the coder writes a page with deliberate layout flaws, the critic reports them, the fixer repairs them.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_PORT ?? 8787);
let fixed = false;

const PLAN = {
  summary: 'صفحة بسيطة لتتبع المهام',
  targetUsers: 'أي مستخدم', type: 'website', primaryLanguage: 'html',
  stack: [{ category: 'language', choice: 'HTML/CSS/JS', version: 'latest', reason: 'بدون اعتماديات' }],
  files: [
    { path: 'index.html', purpose: 'الصفحة الرئيسية' },
    { path: 'style.css', purpose: 'التنسيق' },
    { path: 'app.js', purpose: 'منطق التطبيق' },
  ],
  functions: [{ file: 'app.js', name: 'addTask', signature: 'addTask(text): void', description: 'يضيف مهمة' }],
  screens: [{ name: 'الرئيسية', route: '/', uiTerms: ['Button', 'Card'] }],
  design: { style: 'minimal', palette: { background: '#0f1115', surface: '#171a21', text: '#e8eaf0', accent: '#5eead4', muted: '#98a0b0' }, typography: 'system-ui', spacing: '8px grid', motion: 'subtle' },
  tests: ['إضافة مهمة'], risks: [], assumptions: [], openQuestions: [],
};

const HTML = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>مهامي</title><link rel="stylesheet" href="style.css"></head>
<body><main><h1>مهامي</h1><p class="sub">قائمة بسيطة</p>
<div class="actions"><button id="add" class="b">إضافة</button><button id="clear" class="b">مسح</button></div>
<ul id="list"></ul></main><script src="app.js"></script></body></html>
`;
const CSS_BROKEN = `body{margin:0;background:#888;color:#8a8a8a;font-family:system-ui}
main{padding:24px}
.actions{display:flex;gap:0}
.b{padding:6px 10px;border:0;background:#999;color:#9c9c9c}
`;
const CSS_FIXED = `body{margin:0;background:#0f1115;color:#e8eaf0;font-family:system-ui}
main{padding:24px}
.sub{color:#b4bccb}
.actions{display:flex;gap:16px;margin:16px 0}
.b{min-height:44px;min-width:88px;padding:8px 18px;border:0;border-radius:10px;background:#5eead4;color:#062b26;font-weight:600}
`;
const JS = `const list = document.getElementById('list');
function addTask(text) { const li = document.createElement('li'); li.textContent = text; list.appendChild(li); }
document.getElementById('add').addEventListener('click', () => addTask('مهمة ' + (list.children.length + 1)));
document.getElementById('clear').addEventListener('click', () => { list.textContent = ''; });
`;

function reply(messages) {
  const sys = String(messages[0]?.content ?? '');
  const user = String(messages.at(-1)?.content ?? '');
  if (sys.includes('Request Analyst')) return JSON.stringify({ understanding: 'إضافة سطر "تم التعديل" في الصفحة الرئيسية', files: ['index.html'], newFiles: [], acceptance: ['السطر ظاهر تحت العنوان'] });
  if (sys.includes('Change Reviewer')) return JSON.stringify({ satisfied: true, missing: [] });
  if (sys.includes('Preview Designer')) return '```html\n<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;font-family:sans-serif"><main style="max-width:420px;margin:0 auto;padding:24px"><h1>Mock Phone</h1><button style="min-height:44px;padding:0 16px">Open</button></main></body></html>\n```';
  if (sys.includes('Plan Reviewer')) return 'PLAN_OK';
  if (sys.includes('You are the Planner')) return JSON.stringify(PLAN);
  if (sys.includes('You only write code files')) {
    const m = user.match(/content of `([^`]+)`/);
    const p = m?.[1];
    return p === 'index.html' ? HTML : p === 'style.css' ? CSS_BROKEN : p === 'app.js' ? JS : '';
  }
  if (sys.includes('applying a change request')) {
    return `=====FILE: index.html=====\n${HTML.replace('<p class="sub">قائمة بسيطة</p>', '<p class="sub">قائمة بسيطة</p><p class="note">تم التعديل</p>')}=====END FILE=====`;
  }
  if (sys.includes('Visual Critic')) {
    const flawed = !user.includes('(none measured)');
    return JSON.stringify({
      summary: flawed ? 'الأزرار ملتصقة والتباين ضعيف' : 'التصميم سليم',
      issues: flawed ? [{ id: 'I1', element: '.b', file: 'style.css', type: 'layout', severity: 'high', description: 'الأزرار ملتصقة وتباين النص ضعيف', suggestion: 'أضف gap وغيّر الألوان' }] : [],
    });
  }
  if (sys.includes('You are the Fixer')) { fixed = true; return `=====FILE: style.css=====\n${CSS_FIXED}=====END FILE=====`; }
  if (sys.includes('scoring a project')) {
    return JSON.stringify({ score: 7, criteria: {}, blockers: ['لا توجد اختبارات آلية'], summary: 'يحتاج اختبارات' });
  }
  if (sys.includes('Expert reviewer')) return 'NO_CHANGES';
  return 'ok';
}

createServer(async (req, res) => {
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return; }
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/__state') { res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ fixed })); return; }
  if (url.pathname.endsWith('/models')) {
    res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ data: [
      { id: 'mock-coder', context_length: 128000, pricing: { prompt: '0.000001', completion: '0.000002' } },
      { id: 'mock-free', context_length: 32000, pricing: { prompt: '0', completion: '0' } },
    ] }));
    return;
  }
  if (url.pathname.endsWith('/chat/completions') && req.method === 'POST') {
    let body = '';
    for await (const c of req) body += c;
    const j = JSON.parse(body);
    const text = reply(j.messages ?? []);
    if (!j.stream) {
      res.writeHead(200, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: text } }] }));
      return;
    }
    res.writeHead(200, { ...cors, 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    for (let i = 0; i < text.length; i += 24) {
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: text.slice(i, i + 24) } }] })}\n\n`);
      await new Promise((r) => setTimeout(r, 12));
    }
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  res.writeHead(404, cors).end();
}).listen(PORT, () => console.log(`mock llm on :${PORT}`));
