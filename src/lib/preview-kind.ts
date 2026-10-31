import type { ProjectFile, ProjectType } from '../types';
import { languageOf } from './lang';

export type PreviewKind = 'html' | 'react' | 'next' | 'python' | 'node' | 'remote' | 'mockable' | 'unsupported' | 'none' | 'mock';

export interface KindInfo {
  kind: PreviewKind;
  /** Short label for the badge. */
  label: string;
  /** Why the preview is limited or unavailable (shown to the user). */
  note?: string;
  /** Piston language id when kind === 'remote'. */
  remoteLang?: string;
}

/** file extension → Piston language id (remote runner). */
export const REMOTE_LANGS: Record<string, string> = {
  go: 'go', rs: 'rust', java: 'java', c: 'c', cpp: 'c++', cc: 'c++', cs: 'csharp', php: 'php', rb: 'ruby', kt: 'kotlin',
  swift: 'swift', lua: 'lua', pl: 'perl', r: 'r', scala: 'scala', hs: 'haskell', ex: 'elixir', exs: 'elixir', jl: 'julia',
  dart: 'dart', ts: 'typescript', sh: 'bash', bash: 'bash',
};

export function readPackage(files: ProjectFile[]): { deps: Record<string, string>; scripts: Record<string, string> } {
  const f = files.find((x) => x.path === 'package.json');
  if (!f) return { deps: {}, scripts: {} };
  try {
    const j = JSON.parse(f.content);
    return { deps: { ...(j.dependencies ?? {}), ...(j.devDependencies ?? {}) }, scripts: j.scripts ?? {} };
  } catch {
    return { deps: {}, scripts: {} };
  }
}

const ext = (p: string) => (p.includes('.') ? p.split('.').pop()!.toLowerCase() : '');

/** Picks how a project can be previewed. Pure: depends only on the files. */
export function detectKind(files: ProjectFile[], type: ProjectType, primaryLang: string): KindInfo {
  const paths = files.map((f) => f.path);
  const { deps } = readPackage(files);
  const has = (re: RegExp) => paths.some((p) => re.test(p));

  if (deps.next || has(/(^|\/)next\.config\.(js|mjs|ts|cjs)$/)) {
    return { kind: 'next', label: 'Next.js (تقريبي)', note: 'معاينة تقريبية على المتصفح: الـ routing والـ layouts والمكونات تشتغل، لكن الـ server (API routes, server actions, قواعد البيانات) لا.' };
  }
  if (deps.vue || deps.svelte || deps['@angular/core'] || deps['solid-js'] || has(/\.(vue|svelte)$/)) {
    const fw = deps.vue || has(/\.vue$/) ? 'Vue' : deps.svelte || has(/\.svelte$/) ? 'Svelte' : deps['@angular/core'] ? 'Angular' : 'Solid';
    return { kind: 'unsupported', label: fw, note: `معاينة ${fw} محتاجة build حقيقي (Vite/compiler) مش متاح داخل التطبيق. الكود بيتكتب ويتراجع عادي، والمعاينة تظهر بعد النشر على GitHub Pages.` };
  }
  if (deps.react || has(/\.(jsx|tsx)$/)) {
    return { kind: 'react', label: 'React' };
  }
  const hasIndexHtml = has(/(^|\/)index\.html$/);
  const javaAndroid = files.some((x) => /\.(kt|java)$/.test(x.path) && /import\s+(android|androidx)\./.test(x.content));
  const guiReq = files.some((x) => /(^|\/)(requirements[^/]*\.txt|pyproject\.toml|Pipfile)$/.test(x.path) && /\b(customtkinter|tkinterweb|PyQt[56]?|PySide[26]?|kivy|wxPython|pygame|pyglet|arcade|flet)\b/i.test(x.content));
  const pyGui = guiReq || files.some((x) => /\.py$/.test(x.path) && /^\s*(import|from)\s+(tkinter|customtkinter|PyQt[56]?|PySide[26]?|kivy|wx|pygame|pyglet|arcade)\b/m.test(x.content));
  const nativeUi = has(/(^|\/)AndroidManifest\.xml$/) || has(/(^|\/)pubspec\.yaml$/) || has(/\.(xaml|fxml|storyboard|xib)$/) || has(/\.csproj$/) && files.some((x) => /System\.Windows|WinForms|Avalonia|Maui/.test(x.content)) || javaAndroid || pyGui;
  if (nativeUi && !hasIndexHtml) {
    const what = has(/pubspec\.yaml$/) ? 'Flutter' : pyGui ? 'Python GUI' : has(/\.(xaml|csproj)$/) ? 'Desktop (.NET)' : has(/\.fxml$/) ? 'JavaFX' : 'Android native';
    return { kind: 'mockable', label: what, note: `تطبيق ${what} بيتشغّل على الجهاز نفسه، مش في المتصفح. اضغط «إنشاء معاينة مرئية» والموديل هيرسم محاكاة تفاعلية لشاشاته من الكود (محاكاة للشكل مش تشغيل حقيقي). التشغيل الحقيقي: ابنِ الـ APK/EXE من النشر.` };
  }
  if (has(/\.html?$/)) return { kind: 'html', label: type === 'apk' ? 'Runtime (نسخة ويب للتطبيق)' : 'Website' };

  const runnable = paths.filter((p) => !/(^|\/)(node_modules|test|tests|__tests__)\//.test(p));
  if (runnable.some((p) => ext(p) === 'py') || primaryLang === 'python') return { kind: 'python', label: 'Python (Pyodide)', note: 'بيشتغل Python داخل المتصفح (Pyodide). المكتبات القياسية وأغلب مكتبات العلوم شغالة؛ السيرفرات والـ GUI لا.' };
  if (runnable.some((p) => /\.(js|mjs|cjs)$/.test(p))) return { kind: 'node', label: 'JavaScript (Worker)', note: 'بيشتغل في Worker: console.log شغال، لكن Node APIs (fs, http, …) مش متاحة.' };
  for (const p of runnable) {
    const lang = REMOTE_LANGS[ext(p)];
    if (lang) return { kind: 'remote', label: `${languageOf(p)} (runner بعيد)`, remoteLang: lang, note: 'بيتبعت الكود لخدمة تشغيل خارجية (Piston). الرابط بيتظبط من الإعدادات.' };
  }
  return { kind: 'none', label: '—', note: 'مفيش ملف قابل للتشغيل مباشرة. ممكن تعمل معاينة مرئية بالمحاكاة من الكود.' };
}
