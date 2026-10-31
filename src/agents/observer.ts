// Observer: the preview iframe is sandboxed (opaque origin), so DOM measurement runs INSIDE the iframe via a
// script injected into the preview HTML, and reports results to the host with postMessage.

export type IssueType = 'overlap' | 'touching' | 'clipped' | 'contrast' | 'small-target' | 'a11y' | 'consistency' | 'rtl' | 'console' | 'overflow' | 'resource';

export interface ObservedIssue {
  type: IssueType;
  severity: 'low' | 'medium' | 'high';
  selector: string;
  message: string;
}

export const OBSERVER_SOURCE = String.raw`
(function () {
  var MSG = '__obs';
  var errors = [];
  function post(kind, payload) { try { parent.postMessage({ [MSG]: true, kind: kind, payload: payload }, '*'); } catch (e) {} }

  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) {
      errors.push({ type: 'resource', severity: 'high', selector: e.target.tagName.toLowerCase(), message: 'تعذر تحميل المورد: ' + (e.target.src || e.target.href) });
    } else {
      errors.push({ type: 'console', severity: 'high', selector: 'window', message: String(e.message || 'script error') + (e.lineno ? ' (line ' + e.lineno + ')' : '') });
    }
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    errors.push({ type: 'console', severity: 'high', selector: 'window', message: 'Unhandled promise rejection: ' + String(e.reason && e.reason.message || e.reason) });
  });
  var ce = console.error;
  console.error = function () {
    errors.push({ type: 'console', severity: 'medium', selector: 'console.error', message: Array.prototype.slice.call(arguments).map(String).join(' ').slice(0, 300) });
    return ce.apply(console, arguments);
  };

  function sel(el) {
    if (!el || !el.tagName) return '';
    if (el.id) return el.tagName.toLowerCase() + '#' + el.id;
    var s = el.tagName.toLowerCase();
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    var p = el.parentElement;
    if (p && p !== document.body && p.tagName) {
      var pc = (p.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean)[0];
      s = p.tagName.toLowerCase() + (pc ? '.' + pc : '') + ' > ' + s;
    }
    return s;
  }
  function visible(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none' && parseFloat(cs.opacity) > 0.05;
  }
  function parseColor(c) {
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  function over(top, bottom) {
    var a = top.a + bottom.a * (1 - top.a);
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return { r: (top.r * top.a + bottom.r * bottom.a * (1 - top.a)) / a, g: (top.g * top.a + bottom.g * bottom.a * (1 - top.a)) / a, b: (top.b * top.a + bottom.b * bottom.a * (1 - top.a)) / a, a: a };
  }
  function bgOf(el) {
    var layers = [];
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null; // gradients/images: unknown
      var c = parseColor(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    var base = { r: 255, g: 255, b: 255, a: 1 };
    for (var i = layers.length - 1; i >= 0; i--) base = over(layers[i], base);
    return base;
  }
  function lum(c) {
    function f(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

  function audit() {
    var issues = [];
    var vw = window.innerWidth;
    // 1. overlap / touching interactive elements
    var ctl = Array.prototype.slice.call(document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button], summary')).filter(visible).slice(0, 150);
    var rects = ctl.map(function (e) { return e.getBoundingClientRect(); });
    for (var i = 0; i < ctl.length; i++) {
      for (var j = i + 1; j < ctl.length; j++) {
        if (ctl[i].contains(ctl[j]) || ctl[j].contains(ctl[i])) continue;
        var a = rects[i], b = rects[j];
        var ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        var oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1 && oy > 1) {
          issues.push({ type: 'overlap', severity: 'high', selector: sel(ctl[i]) + ' ⟷ ' + sel(ctl[j]), message: 'عنصران تفاعليان متداخلان (' + Math.round(ox) + 'x' + Math.round(oy) + 'px)' });
        } else {
          var gapX = Math.max(a.left, b.left) - Math.min(a.right, b.right);
          var gapY = Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom);
          if ((oy > Math.min(a.height, b.height) * 0.4 && gapX >= -1 && gapX < 4) || (ox > Math.min(a.width, b.width) * 0.4 && gapY >= -1 && gapY < 4)) {
            issues.push({ type: 'touching', severity: 'medium', selector: sel(ctl[i]) + ' ⟷ ' + sel(ctl[j]), message: 'عنصران لازقين في بعض (المسافة ' + Math.max(0, Math.round(Math.min(gapX > -1 && oy > 0 ? gapX : 99, gapY > -1 && ox > 0 ? gapY : 99))) + 'px، المطلوب 8px على الأقل)' });
          }
        }
      }
    }
    // 2. small touch targets
    ctl.forEach(function (e, k) {
      var r = rects[k];
      if (e.tagName === 'INPUT' && /checkbox|radio/.test(e.type)) return;
      if (r.height < 36 || r.width < 36) issues.push({ type: 'small-target', severity: 'low', selector: sel(e), message: 'هدف لمس صغير (' + Math.round(r.width) + 'x' + Math.round(r.height) + 'px، المطلوب 44px تقريبًا)' });
    });
    // 3. text contrast + clipping
    var seen = 0;
    var all = document.body ? document.body.querySelectorAll('*') : [];
    for (var n = 0; n < all.length && seen < 400; n++) {
      var el = all[n];
      var hasText = false;
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.textContent.trim().length > 1) { hasText = true; break; }
      if (!hasText || !visible(el)) continue;
      seen++;
      var cs = getComputedStyle(el);
      var fg = parseColor(cs.color), bg = bgOf(el);
      if (fg && bg) {
        var fgOver = over(fg, bg);
        var cr = ratio(fgOver, bg);
        var size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight, 10) >= 700;
        var need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        if (cr < need) issues.push({ type: 'contrast', severity: cr < 3 ? 'high' : 'medium', selector: sel(el), message: 'تباين ضعيف ' + cr.toFixed(2) + ':1 (المطلوب ' + need + ':1) — لون النص ' + cs.color + ' على خلفية rgb(' + Math.round(bg.r) + ',' + Math.round(bg.g) + ',' + Math.round(bg.b) + ')' });
      }
      if ((cs.overflow === 'hidden' || cs.overflowX === 'hidden') && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis' && el.clientWidth > 0) {
        issues.push({ type: 'clipped', severity: 'medium', selector: sel(el), message: 'نص مقصوص (المحتوى ' + el.scrollWidth + 'px داخل ' + el.clientWidth + 'px)' });
      }
    }
    // 4. horizontal overflow of the page
    if (document.documentElement.scrollWidth > vw + 2) issues.push({ type: 'overflow', severity: 'high', selector: 'html', message: 'الصفحة بتعمل scroll أفقي (' + document.documentElement.scrollWidth + 'px مقابل ' + vw + 'px)' });
    // 5. accessibility basics
    Array.prototype.forEach.call(document.querySelectorAll('img:not([alt])'), function (im) { issues.push({ type: 'a11y', severity: 'medium', selector: sel(im), message: 'صورة بدون alt' }); });
    Array.prototype.forEach.call(document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea'), function (inp) {
      if (!visible(inp)) return;
      var labelled = inp.getAttribute('aria-label') || inp.getAttribute('aria-labelledby') || (inp.id && document.querySelector('label[for="' + inp.id + '"]')) || inp.closest('label') || inp.getAttribute('title');
      if (!labelled) issues.push({ type: 'a11y', severity: 'medium', selector: sel(inp), message: 'حقل إدخال بدون label' });
    });
    Array.prototype.forEach.call(document.querySelectorAll('button, a[href]'), function (bt) {
      if (!visible(bt)) return;
      if (!bt.textContent.trim() && !bt.getAttribute('aria-label') && !bt.getAttribute('title') && !bt.querySelector('img[alt]')) issues.push({ type: 'a11y', severity: 'medium', selector: sel(bt), message: 'زر/رابط بدون نص أو aria-label' });
    });
    if (!document.querySelector('meta[name=viewport]')) issues.push({ type: 'a11y', severity: 'medium', selector: 'head', message: 'ناقص <meta name="viewport"> (الموقع مش متجاوب على الموبايل)' });
    // 6. consistency
    var btns = Array.prototype.slice.call(document.querySelectorAll('button, .btn, a.button, [role=button]')).filter(visible);
    var radii = {}, fonts = {};
    btns.forEach(function (b) { radii[getComputedStyle(b).borderRadius] = 1; });
    Array.prototype.forEach.call(document.querySelectorAll('p, h1, h2, h3, button, a, li, span, label'), function (t) { if (visible(t)) fonts[getComputedStyle(t).fontFamily.split(',')[0].trim()] = 1; });
    if (Object.keys(radii).length > 3) issues.push({ type: 'consistency', severity: 'low', selector: 'buttons', message: 'الأزرار فيها ' + Object.keys(radii).length + ' قيم مختلفة لـ border-radius (لازم نظام واحد)' });
    if (Object.keys(fonts).length > 3) issues.push({ type: 'consistency', severity: 'low', selector: 'body', message: 'أكتر من 3 عائلات خطوط مستخدمة (' + Object.keys(fonts).join(', ') + ')' });
    // 7. RTL
    var text = (document.body && document.body.innerText) || '';
    if (/[؀-ۿ]/.test(text)) {
      var h = document.documentElement;
      if (h.getAttribute('dir') !== 'rtl' && getComputedStyle(document.body).direction !== 'rtl') issues.push({ type: 'rtl', severity: 'high', selector: 'html', message: 'المحتوى عربي لكن الصفحة مش dir="rtl"' });
    }
    return issues.concat(errors);
  }

  window.__audit = audit;
  function run() { post('audit', { issues: audit(), width: window.innerWidth, height: window.innerHeight, title: document.title, bodyText: ((document.body && document.body.innerText) || '').slice(0, 1500) }); }
  window.addEventListener('message', function (e) { if (e.data && e.data[MSG] === 'run') run(); });
  window.addEventListener('load', function () { setTimeout(run, 600); });
  post('ready', {});
})();
`;

export function issueKey(i: ObservedIssue): string {
  return `${i.type}|${i.selector}|${i.message.replace(/\d+(\.\d+)?/g, '#')}`;
}

/** Merges new audit results into the accumulated set (dedup by type+selector+message shape). */
export function mergeIssues(acc: ObservedIssue[], next: ObservedIssue[]): ObservedIssue[] {
  const map = new Map(acc.map((i) => [issueKey(i), i]));
  for (const i of next) if (!map.has(issueKey(i))) map.set(issueKey(i), i);
  return [...map.values()];
}

export function weight(i: ObservedIssue): number {
  return i.severity === 'high' ? 3 : i.severity === 'medium' ? 2 : 1;
}

export interface CycleRecord {
  issuesBefore: number;
  issuesAfter: number;
}

export type StopReason = 'max-cycles' | 'no-progress' | null;

/**
 * Stop conditions for the fix loop (avoid endless loops):
 *  - at most `maxCycles` cycles per request;
 *  - if the issue count did not decrease two cycles in a row, stop and report.
 */
export function shouldStop(history: CycleRecord[], maxCycles: number): StopReason {
  if (history.length >= maxCycles) return 'max-cycles';
  const last = history.slice(-2);
  if (last.length === 2 && last.every((c) => c.issuesAfter >= c.issuesBefore)) return 'no-progress';
  return null;
}

/** Injects the observer script into an HTML document (before </head> or at the top). */
export function injectObserver(html: string): string {
  const tag = `<script>${OBSERVER_SOURCE.replace(/<\/script/gi, '<\\/script')}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + '<head>' + tag + '</head>');
  return tag + html;
}
