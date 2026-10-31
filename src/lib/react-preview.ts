// In-browser preview for React and (approximate) Next.js projects.
// No bundler: every local file is transpiled by Babel (loaded from a CDN inside the sandboxed iframe),
// turned into a blob: module and wired together through an import map. Packages come from esm.sh.
import type { ProjectFile } from '../types';
import { injectObserver } from '../agents/observer';
import { buildPreviewHtml, resolvePath } from './preview';
import { readPackage } from './preview-kind';

export const BABEL_URL = 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.4/babel.min.js';
const SCRIPT_RE = /\.(jsx?|tsx?|mjs|cjs)$/;

export interface NextRoute {
  /** URL pattern such as "/", "/blog/[slug]", "/docs/[...rest]". */
  route: string;
  file: string;
  /** Layouts from the root down to the page's own folder (app router only). */
  layouts: string[];
}

/** Finds Next.js routes (app router and pages router). Pure and unit-tested. */
export function nextRoutes(files: ProjectFile[]): { routes: NextRoute[]; app: string | null; notFound: string | null } {
  const paths = new Set(files.map((f) => f.path));
  const routes: NextRoute[] = [];
  const root = (p: string) => (paths.has(`src/${p}`) ? `src/${p}` : p);
  const appDir = ['app', 'src/app'].find((d) => files.some((f) => f.path.startsWith(d + '/') && /\/page\.(jsx?|tsx?)$/.test(f.path)));
  if (appDir) {
    for (const f of files) {
      const m = f.path.match(new RegExp(`^${appDir}/(?:(.*)/)?page\\.(jsx?|tsx?)$`));
      if (!m) continue;
      const segs = (m[1] ?? '').split('/').filter(Boolean);
      const visible = segs.filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@'));
      const layouts: string[] = [];
      for (let i = 0; i <= segs.length; i++) {
        const dir = [appDir, ...segs.slice(0, i)].join('/');
        const l = ['js', 'jsx', 'ts', 'tsx'].map((e) => `${dir}/layout.${e}`).find((x) => paths.has(x));
        if (l) layouts.push(l);
      }
      routes.push({ route: '/' + visible.join('/'), file: f.path, layouts });
    }
    const nf = files.find((f) => new RegExp(`^${appDir}/not-found\\.(jsx?|tsx?)$`).test(f.path))?.path ?? null;
    return { routes: sortRoutes(routes), app: appDir, notFound: nf };
  }
  const pagesDir = ['pages', 'src/pages'].find((d) => files.some((f) => f.path.startsWith(d + '/') && SCRIPT_RE.test(f.path)));
  if (pagesDir) {
    const appFile = files.find((f) => new RegExp(`^${pagesDir}/_app\\.(jsx?|tsx?)$`).test(f.path))?.path ?? null;
    for (const f of files) {
      const m = f.path.match(new RegExp(`^${pagesDir}/(.*)\\.(jsx?|tsx?)$`));
      if (!m || m[1].startsWith('api/') || /^(_(app|document|error)|404|500)$/.test(m[1])) continue;
      const r = m[1].replace(/(^|\/)index$/, '');
      routes.push({ route: '/' + r, file: f.path, layouts: [] });
    }
    const nf = files.find((f) => new RegExp(`^${pagesDir}/404\\.(jsx?|tsx?)$`).test(f.path))?.path ?? null;
    return { routes: sortRoutes(routes), app: appFile, notFound: nf };
  }
  void root;
  return { routes: [], app: null, notFound: null };
}

/** Static routes first, then dynamic, then catch-all. */
function sortRoutes(r: NextRoute[]): NextRoute[] {
  const score = (x: NextRoute) => (x.route.includes('[...') ? 2 : x.route.includes('[') ? 1 : 0);
  return [...r].sort((a, b) => score(a) - score(b) || a.route.localeCompare(b.route));
}

const cleanVersion = (v?: string) => (v ?? '').replace(/^[\^~>=<\s]+/, '').split(' ')[0].replace(/^workspace:.*|^(git|file|link):.*|^\*$|^latest$/, '');

/** Finds the module that boots the app. */
export function findReactEntry(files: ProjectFile[]): { entry: string | null; mounted: boolean } {
  const by = new Map(files.map((f) => [f.path, f.content]));
  const html = by.get('index.html');
  if (html) {
    const m = html.match(/<script\b[^>]*type\s*=\s*["']module["'][^>]*src\s*=\s*["']([^"']+)["']/i) ?? html.match(/<script\b[^>]*src\s*=\s*["']([^"']+)["'][^>]*type\s*=\s*["']module["']/i);
    if (m && !/^(https?:)?\/\//.test(m[1])) {
      const p = resolvePath('index.html', m[1]);
      if (by.has(p)) return { entry: p, mounted: /createRoot|ReactDOM\.render|hydrateRoot|\.render\s*\(/.test(by.get(p)!) };
    }
  }
  const cands = ['src/main', 'src/index', 'main', 'index', 'src/App', 'App'];
  for (const c of cands) for (const e of ['jsx', 'tsx', 'js', 'ts']) {
    const p = `${c}.${e}`;
    if (by.has(p)) return { entry: p, mounted: /createRoot|ReactDOM\.render|hydrateRoot|\.render\s*\(/.test(by.get(p)!) };
  }
  return { entry: null, mounted: false };
}

export interface ReactPreviewConfig {
  files: Record<string, string>;
  entry: string | null;
  mounted: boolean;
  next: { routes: NextRoute[]; app: string | null; notFound: string | null } | null;
  versions: { react: string; reactDom: string };
  deps: Record<string, string>;
  tailwind: boolean;
}

export function makeConfig(files: ProjectFile[], next: boolean): ReactPreviewConfig {
  const { deps } = readPackage(files);
  const { entry, mounted } = findReactEntry(files);
  const react = cleanVersion(deps.react) || '18.3.1';
  const useFull = /^\d+\.\d+\.\d+$/.test(react);
  const major = react.split('.')[0];
  const rv = useFull ? react : /^\d+$/.test(major) ? major : '18.3.1';
  const map: Record<string, string> = {};
  for (const f of files) if (!/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp4|mp3|zip|pdf)$/i.test(f.path)) map[f.path] = f.content;
  const tailwind = !!deps.tailwindcss || files.some((f) => /^tailwind\.config\./.test(f.path)) || files.some((f) => f.path.endsWith('.css') && /@tailwind\b/.test(f.content));
  return { files: map, entry, mounted, next: next ? nextRoutes(files) : null, versions: { react: rv, reactDom: rv }, deps, tailwind };
}

/** The script that runs inside the preview iframe. Plain JS (no imports): it is inlined into the HTML. */
export const BOOTSTRAP = String.raw`
(async function () {
  var cfg = window.__CFG, files = cfg.files;
  var root = document.getElementById('root') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'root' }));
  function fail(e) {
    console.error(e);
    var m = (e && (e.stack || e.message)) || String(e);
    root.innerHTML = '<pre style="white-space:pre-wrap;color:#b91c1c;background:#fef2f2;padding:16px;margin:0;font:13px/1.5 monospace" dir="ltr"></pre>';
    root.firstChild.textContent = 'Preview error:\n' + m;
  }
  window.addEventListener('error', function (ev) { if (!root.firstChild) fail(ev.error || ev.message); });
  try {
    window.process = window.process || { env: { NODE_ENV: 'development' }, browser: true };
    var EXT = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'];
    function dirname(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
    function join(a, b) {
      var out = [];
      (a ? a.split('/') : []).concat(b.split('/')).forEach(function (s) { if (!s || s === '.') return; if (s === '..') out.pop(); else out.push(s); });
      return out.join('/');
    }
    function findLocal(from, spec) {
      var base;
      if (spec.charAt(0) === '.') base = join(dirname(from), spec);
      else if (spec.indexOf('@/') === 0 || spec.indexOf('~/') === 0) base = spec.slice(2);
      else if (spec.charAt(0) === '/') base = spec.slice(1);
      else return null;
      var roots = spec.charAt(0) === '.' || spec.charAt(0) === '/' ? [''] : ['src/', ''];
      for (var r = 0; r < roots.length; r++) for (var i = 0; i < EXT.length; i++) {
        var p = roots[r] + base + EXT[i];
        if (Object.prototype.hasOwnProperty.call(files, p)) return p;
      }
      return null;
    }
    var REACT_BARE = { 'react': 1, 'react-dom': 1, 'react-dom/client': 1, 'react/jsx-runtime': 1, 'react/jsx-dev-runtime': 1 };
    var NEXT_SHIMS = { 'next/link': 1, 'next/image': 1, 'next/navigation': 1, 'next/router': 1, 'next/head': 1, 'next/dynamic': 1, 'next/script': 1, 'server-only': 1, 'client-only': 1 };
    var imports = {};
    var rv = cfg.versions.react;
    imports['react'] = 'https://esm.sh/react@' + rv;
    imports['react/jsx-runtime'] = 'https://esm.sh/react@' + rv + '/jsx-runtime';
    imports['react/jsx-dev-runtime'] = 'https://esm.sh/react@' + rv + '/jsx-dev-runtime';
    imports['react-dom'] = 'https://esm.sh/react-dom@' + rv + '?external=react';
    imports['react-dom/client'] = 'https://esm.sh/react-dom@' + rv + '/client?external=react';
    function pkgUrl(spec) {
      var m = spec.match(/^(@[^/]+\/[^/]+|[^/]+)(\/.*)?$/);
      var name = m[1], sub = m[2] || '';
      var v = (cfg.deps[name] || '').replace(/^[\^~>=<\s]+/, '').split(' ')[0];
      if (!/^\d/.test(v)) v = '';
      return 'https://esm.sh/' + name + (v ? '@' + v : '') + sub + '?external=react,react-dom';
    }
    var blobs = {};
    function blob(code) { return URL.createObjectURL(new Blob([code], { type: 'text/javascript' })); }
    var FONT = 'const __f=()=>({className:"",style:{},variable:""});const __nextFont=new Proxy({},{get:()=>__f});';

    function rewrite(code, from) {
      code = code.replace(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/(?:google|local)["'];?/g, function (_, names) {
        return FONT + 'const {' + names.replace(/\s+as\s+/g, ': ') + '} = __nextFont;';
      }).replace(/import\s+(\w+)\s+from\s*["']next\/font\/local["'];?/g, function (_, n) { return FONT + 'const ' + n + ' = __f;'; });
      return code.replace(/(\b(?:from|import)\s*\(?\s*)(["'])([^"'\n]+)\2/g, function (m, pre, q, spec) {
        if (spec.indexOf('data:') === 0 || spec.indexOf('http') === 0 || spec.indexOf('~shim/') === 0) return m;
        var local = findLocal(from, spec);
        if (local) return pre + q + '~/' + local + q;
        if (spec.charAt(0) === '.' || spec.charAt(0) === '/') return pre + q + '~missing' + q;
        var base = spec.charAt(0) !== '@' && !cfg.deps[spec.split('/')[0]] ? findLocal('', '@/' + spec) : null;
        if (base) return pre + q + '~/' + base + q;
        if (cfg.next && NEXT_SHIMS[spec]) return pre + q + '~shim/' + spec + q;
        if (REACT_BARE[spec]) return m;
        return pre + q + pkgUrl(spec) + q;
      });
    }

    var babel = window.Babel;
    if (!babel) throw new Error('Babel failed to load (is the device online?)');
    var q;
    Object.keys(files).forEach(function (p) {
      var src = files[p], code;
      if (/\.(jsx?|tsx?|mjs|cjs)$/.test(p)) {
        try {
          code = babel.transform(src, { filename: p, sourceType: 'module', presets: [['react', { runtime: 'automatic' }], ['typescript', { isTSX: true, allExtensions: true }]], retainLines: false }).code;
        } catch (e) { e.message = p + ': ' + e.message; throw e; }
        code = rewrite(code, p);
      } else if (/\.css$/.test(p)) {
        var tw = /@tailwind\b|@apply\b/.test(src);
        code = 'var s=document.createElement("style");' + (tw ? 's.type="text/tailwindcss";' : '') + 's.textContent=' + JSON.stringify(src) + ';document.head.appendChild(s);export default "";';
      } else if (/\.json$/.test(p)) {
        code = 'export default ' + src + ';';
      } else if (/\.svg$/.test(p)) {
        code = 'export default ' + JSON.stringify('data:image/svg+xml;utf8,' + encodeURIComponent(src)) + ';';
      } else return;
      imports['~/' + p] = blob(code);
    });
    // Assets we cannot inline resolve to an empty string.
    imports['~missing'] = blob('export default "";');
    var SHIM = {
      'next/link': 'import React from "react";export default function Link(p){var h=p.href;if(h&&typeof h==="object")h=(h.pathname||"")+(h.search||"");h=String(h==null?"#":h);var r=Object.assign({},p);["href","children","onClick","replace","prefetch","scroll","legacyBehavior","passHref","shallow","locale"].forEach(function(k){delete r[k]});return React.createElement("a",Object.assign({},r,{href:h,onClick:function(e){if(p.onClick)p.onClick(e);if(e.defaultPrevented||e.metaKey||e.ctrlKey||/^(https?:|mailto:|tel:)/.test(h))return;e.preventDefault();window.__nav.go(h,p.replace)}}),p.children)}',
      'next/image': 'import React from "react";export default function Image(p){var s=p.src;if(s&&typeof s==="object")s=s.src;var st=Object.assign({},p.style);if(p.fill)Object.assign(st,{position:"absolute",inset:0,width:"100%",height:"100%"});var r=Object.assign({},p);["src","fill","priority","quality","placeholder","blurDataURL","loader","unoptimized","sizes","style"].forEach(function(k){delete r[k]});return React.createElement("img",Object.assign({},r,{src:s,style:st,alt:p.alt||""}))}',
      'next/head': 'export default function Head(){return null}',
      'next/script': 'export default function Script(){return null}',
      'server-only': 'export default {}', 'client-only': 'export default {}',
      'next/dynamic': 'import React from "react";export default function dynamic(loader,opts){var L=React.lazy(function(){return Promise.resolve(typeof loader==="function"?loader():loader).then(function(m){return {default:(m&&m.default)||m}})});return function(p){return React.createElement(React.Suspense,{fallback:(opts&&opts.loading)?React.createElement(opts.loading):null},React.createElement(L,p))}}',
      'next/navigation': 'import React from "react";function sub(cb){return window.__nav.sub(cb)}function useNav(){return React.useSyncExternalStore(sub,function(){return window.__nav.version})}export function usePathname(){useNav();return window.__nav.path}export function useSearchParams(){useNav();return new URLSearchParams(window.__nav.search)}export function useParams(){useNav();return window.__nav.params||{}}export function useRouter(){return{push:function(h){window.__nav.go(h)},replace:function(h){window.__nav.go(h,true)},back:function(){history.back()},forward:function(){history.forward()},refresh:function(){},prefetch:function(){}}}export function redirect(h){window.__nav.go(h,true);throw new Error("NEXT_REDIRECT")}export function notFound(){throw new Error("NEXT_NOT_FOUND")}export function useSelectedLayoutSegment(){return null}export function useSelectedLayoutSegments(){return[]}',
      'next/router': 'import React from "react";function sub(cb){return window.__nav.sub(cb)}export function useRouter(){React.useSyncExternalStore(sub,function(){return window.__nav.version});var n=window.__nav;return{pathname:n.pattern||n.path,route:n.pattern||n.path,asPath:n.path+(n.search||""),query:Object.assign({},n.params||{},Object.fromEntries(new URLSearchParams(n.search))),push:function(h){n.go(typeof h==="object"?h.pathname:h)},replace:function(h){n.go(typeof h==="object"?h.pathname:h,true)},back:function(){history.back()},reload:function(){},prefetch:function(){return Promise.resolve()},isReady:true,events:{on:function(){},off:function(){}}}}export default{}'
    };
    Object.keys(SHIM).forEach(function (k) { imports['~shim/' + k] = blob(SHIM[k]); });

    var tag = document.createElement('script');
    tag.type = 'importmap';
    tag.textContent = JSON.stringify({ imports: imports });
    document.head.appendChild(tag);

    var React = await import('react');
    var RDC = await import('react-dom/client');
    function mount(el) { RDC.createRoot(root).render(el); }

    if (!cfg.next) {
      if (!cfg.entry) throw new Error('No React entry found (expected src/main.jsx, src/index.jsx or App.jsx)');
      var mod = await import('~/' + cfg.entry);
      if (!cfg.mounted) {
        var C = mod.default || mod.App;
        if (!C) throw new Error(cfg.entry + ' has no default export to render');
        mount(React.createElement(C));
      }
      return;
    }

    // ----- Next.js (approximate): client-side router over the discovered routes -----
    var info = cfg.next, listeners = [];
    function match(path) {
      for (var i = 0; i < info.routes.length; i++) {
        var r = info.routes[i], rs = r.route.split('/').filter(Boolean), ps = path.split('/').filter(Boolean), params = {}, ok = true;
        for (var j = 0; j < rs.length; j++) {
          var s = rs[j];
          if (/^\[\[?\.\.\./.test(s)) { params[s.replace(/[\[\]\.]/g, '')] = ps.slice(j); j = rs.length; ps = null; break; }
          if (ps[j] === undefined) { ok = false; break; }
          if (/^\[.*\]$/.test(s)) params[s.slice(1, -1)] = decodeURIComponent(ps[j]);
          else if (s !== ps[j]) { ok = false; break; }
        }
        if (ok && ps && ps.length > rs.length) ok = false;
        if (ok) return { route: r, params: params };
      }
      return null;
    }
    var nav = window.__nav = {
      path: '/', search: '', params: {}, pattern: '/', version: 0,
      sub: function (cb) { listeners.push(cb); return function () { listeners = listeners.filter(function (x) { return x !== cb; }); }; },
      go: function (h, replace) {
        var u = new URL(String(h), 'http://x' + nav.path);
        nav.path = u.pathname; nav.search = u.search; nav.version++;
        listeners.slice().forEach(function (l) { l(); });
      }
    };
    var cache = {};
    async function load(p) { return cache[p] || (cache[p] = await import('~/' + p)); }
    function unwrapHtml(el) {
      if (el && el.type === 'html') {
        var kids = React.Children.toArray(el.props.children), body = kids.filter(function (k) { return k && k.type === 'body'; })[0];
        if (body) return React.createElement('div', { className: body.props.className, style: body.props.style, id: 'next-body' }, body.props.children);
        return React.createElement(React.Fragment, null, el.props.children);
      }
      return el;
    }
    function Async(p) {
      var st = React.useState(null), v = st[0], set = st[1], er = React.useState(null);
      React.useEffect(function () {
        var dead = false;
        Promise.resolve(p.fn(p.props)).then(function (r) { if (!dead) set({ el: r }); }, function (e) { if (!dead) er[1](e); });
        return function () { dead = true; };
      }, [p.fn, JSON.stringify(p.props || {})]);
      if (er[0]) throw er[0];
      return v ? v.el : null;
    }
    function comp(fn, props, children) {
      if (fn && fn.constructor && fn.constructor.name === 'AsyncFunction') return React.createElement(Async, { fn: fn, props: Object.assign({}, props, { children: children }) });
      return React.createElement(fn, props, children);
    }
    function Boundary() { React.Component.apply(this, arguments); }
    Boundary.prototype = Object.create(React.Component.prototype);
    Boundary.getDerivedStateFromError = function (e) { return { e: e }; };
    Boundary.prototype.componentDidCatch = function (e) { console.error(e); };
    Boundary.prototype.render = function () {
      if (this.state && this.state.e) {
        var msg = String(this.state.e && this.state.e.message || this.state.e);
        if (/NEXT_NOT_FOUND/.test(msg)) return React.createElement('h1', null, '404 — This page could not be found');
        if (/NEXT_REDIRECT/.test(msg)) return null;
        return React.createElement('pre', { style: { whiteSpace: 'pre-wrap', color: '#b91c1c', padding: 16 }, dir: 'ltr' }, 'Render error:\n' + msg);
      }
      return this.props.children;
    };
    function NextApp() {
      React.useSyncExternalStore(function (cb) { return nav.sub(cb); }, function () { return nav.version; });
      var st = React.useState(null), ready = st[0], setReady = st[1];
      var m = match(nav.path);
      React.useEffect(function () {
        var dead = false;
        (async function () {
          try {
            if (!m) { var nf = info.notFound ? [await load(info.notFound)] : []; if (!dead) setReady({ nf: nf[0] && nf[0].default }); return; }
            nav.params = m.params; nav.pattern = m.route.route;
            var page = await load(m.route.file);
            var layouts = [];
            for (var i = 0; i < m.route.layouts.length; i++) layouts.push((await load(m.route.layouts[i])).default);
            var app = (!m.route.layouts.length && info.app) ? (await load(info.app)).default : null;
            if (!dead) setReady({ page: page.default, layouts: layouts, app: app, params: m.params });
          } catch (e) { if (!dead) setReady({ err: e }); }
        })();
        return function () { dead = true; };
      }, [nav.path, nav.version]);
      if (!ready) return null;
      if (ready.err) throw ready.err;
      if (ready.nf !== undefined) return ready.nf ? React.createElement(ready.nf) : React.createElement('h1', null, '404 — This page could not be found');
      var props = { params: Promise.resolve(ready.params), searchParams: Promise.resolve(Object.fromEntries(new URLSearchParams(nav.search))) };
      var el;
      if (ready.app) el = React.createElement(ready.app, { Component: ready.page, pageProps: {} });
      else el = comp(ready.page, props);
      for (var k = ready.layouts.length - 1; k >= 0; k--) {
        (function (L, child, isRoot) {
          var W = function (p) { return unwrapHtml(L(p)); };
          el = isRoot ? React.createElement(W, { children: child, params: props.params }) : comp(L, { params: props.params }, child);
        })(ready.layouts[k], el, k === 0);
      }
      return el;
    }
    mount(React.createElement(Boundary, null, React.createElement(NextApp)));
  } catch (e) { fail(e); }
})();
`;

/** Builds the sandboxed preview document for React / Next.js projects. */
export function buildReactPreviewHtml(files: ProjectFile[], kind: 'react' | 'next', opts: { observer?: boolean } = {}): { html: string; entry: string | null; revoke: () => void } {
  const cfg = makeConfig(files, kind === 'next');
  const html = files.find((f) => f.path === 'index.html');
  let base: string;
  let revoke = () => {};
  if (html && kind === 'react') {
    // Reuse the static builder for index.html (inlines local CSS/links); drop the module script, we boot it ourselves.
    const cleaned = files.map((f) => (f.path === 'index.html' ? { ...f, content: f.content.replace(/<script\b[^>]*type\s*=\s*["']module["'][^>]*><\/script>/gi, '') } : f));
    const built = buildPreviewHtml(cleaned, {});
    base = built.html;
    revoke = built.revoke;
  } else {
    base = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preview</title></head><body><div id="root"></div></body></html>';
  }
  if (!/id\s*=\s*["']root["']/.test(base)) base = base.replace(/<body[^>]*>/i, (m) => m + '<div id="root"></div>');
  const json = JSON.stringify(cfg).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '');
  const head = `<script src="${BABEL_URL}"></script>${cfg.tailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : ''}`;
  const boot = `<script>window.__CFG=${json};</script><script>${BOOTSTRAP.replace(/<\/script/gi, '<\\/script')}</script>`;
  let out = /<head[^>]*>/i.test(base) ? base.replace(/<head[^>]*>/i, (m) => m + head) : head + base;
  out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, () => boot + '</body>') : out + boot;
  if (opts.observer) out = injectObserver(out);
  return { html: out, entry: cfg.entry ?? (kind === 'next' ? 'next' : null), revoke };
}
