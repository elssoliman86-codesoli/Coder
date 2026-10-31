// ui_lookup: the NameThatUI reference tool (https://namethatui.com).
// NameThatUI is a "visual dictionary of UI": each element has a real name, API symbols, an anatomy and a
// paste-ready prompt for coding agents; /styles catalogues visual styles. This module ships a small offline
// vocabulary (written for this project) and, when the network and CORS allow, enriches it with the live
// page (cached 7 days, at most a few pages per run, identified User-Agent where the platform allows).
// Attribution is shown in the About screen.

export interface UiTerm {
  name: string;
  slug: string;
  keywords: string[];
  api: string;
  prompt: string;
}

export interface UiStyle {
  name: string;
  slug: string;
  keywords: string[];
  signals: string[];
}

export const TERMS: UiTerm[] = [
  { name: 'Hamburger Menu (Nav Drawer)', slug: 'hamburger-menu', keywords: ['hamburger', 'menu', 'drawer', 'side menu', 'burger', 'قائمة جانبية', 'قايمة', 'هامبرجر'], api: 'aria-expanded + aria-controls · <nav> · shadcn Sheet side · Material NavigationDrawer', prompt: 'A <button aria-expanded aria-controls> with three stacked lines toggles an off-canvas <nav> drawer that slides over a scrim. Lock body scroll while open, close on Escape and scrim tap, keep aria-expanded in sync, return focus to the button on close.' },
  { name: 'Card', slug: 'card', keywords: ['card', 'cards', 'tile', 'كارت', 'كروت', 'بطاقة'], api: '<Card> · media, title, body, footer', prompt: 'A rectangular surface with optional media, a title, body text and a footer of actions. Consistent radius, padding and elevation; the whole card or one clear action is clickable, never both.' },
  { name: 'Bento Grid', slug: 'bento-grid', keywords: ['bento', 'grid', 'dashboard', 'features', 'مربعات', 'شبكة'], api: 'display: grid + grid-column: span 2', prompt: 'One CSS grid with mixed tile sizes (some span 2 columns or rows) packed like a bento box; equal gaps, one radius, each tile a single idea.' },
  { name: 'Site Header vs. Navigation Bar', slug: 'header-navbar', keywords: ['header', 'navbar', 'navigation', 'top bar', 'topbar', 'شريط علوي', 'هيدر'], api: '<header> · <nav>', prompt: 'The whole top strip is the <header> (logo, actions); the row of page links inside it is the <nav>. Sticky only when it helps; collapse the nav into a drawer on phones.' },
  { name: 'Modal Dialog vs. Drawer vs. Sheet', slug: 'dialog-drawer-sheet', keywords: ['modal', 'dialog', 'popup', 'sheet', 'drawer', 'نافذة', 'حوار'], api: '<dialog> · Sheet side', prompt: 'Modal dialog: centred, blocks the page, for short decisions. Drawer: edge-attached, for navigation or detail. Sheet: bottom-attached on phones for task flows. All trap focus, close on Escape and return focus.' },
  { name: 'Scrim (Backdrop / Overlay)', slug: 'scrim', keywords: ['scrim', 'backdrop', 'overlay', 'dim'], api: '::backdrop', prompt: 'The translucent layer between a modal surface and the page; dims the page, blocks pointer events behind, dismisses the surface on tap when appropriate.' },
  { name: 'Toast (Snackbar)', slug: 'toast', keywords: ['toast', 'snackbar', 'notification', 'إشعار', 'اشعار', 'رسالة'], api: 'role="status"', prompt: 'A brief, non-blocking message after an action ("Changes saved"); auto-dismisses after a few seconds, can carry one action (Undo), announced politely to screen readers.' },
  { name: 'Command Palette', slug: 'command-palette', keywords: ['command', 'palette', 'search', 'shortcut', 'بحث'], api: 'Command · ⌘K', prompt: 'A keyboard-first searchable launcher opened with ⌘K / Ctrl+K listing actions and navigation targets with fuzzy filtering and arrow-key selection.' },
  { name: 'Empty State', slug: 'empty-state', keywords: ['empty', 'no data', 'nothing', 'no projects', 'فاضي', 'فارغ'], api: '<section>', prompt: 'Purposeful guidance when a view has no content: an illustration or icon, one sentence explaining why, and a single primary action to fix it.' },
  { name: 'Skeleton vs. Spinner', slug: 'skeleton-spinner', keywords: ['skeleton', 'spinner', 'loading', 'تحميل'], api: 'aria-busy="true"', prompt: 'Skeleton: grey placeholders in the final layout for predictable content. Spinner: only for indeterminate waits with no known layout. Prefer a progress ring/bar when progress is measurable.' },
  { name: 'Progress Ring vs. Spinner vs. Progress Bar', slug: 'progress-indicators', keywords: ['progress', 'ring', 'bar', 'percent', 'تقدم'], api: '<progress>', prompt: 'A spinner means "wait"; a ring or bar shows how much is done. Use <progress> semantics, show the number when it helps.' },
  { name: 'Data Table (Table View)', slug: 'data-table', keywords: ['table', 'data table', 'rows', 'columns', 'list models', 'جدول'], api: '<table>', prompt: 'Rows and columns of records with sortable column headers (aria-sort), sticky header, right-aligned numbers, zebra or hairline separators, and an empty state.' },
  { name: 'Tabs', slug: 'tabs', keywords: ['tabs', 'tab', 'تبويب', 'تبويبات'], api: 'role="tablist"', prompt: 'A single row of labels switching one shared content region; arrow keys move between tabs, the selected tab is visibly distinct and aria-selected.' },
  { name: 'Popover vs. Dropdown Menu vs. Tooltip', slug: 'popover-dropdown-tooltip', keywords: ['popover', 'dropdown', 'tooltip', 'menu'], api: 'popover', prompt: 'Popover: anchored rich content. Dropdown menu: a list of actions. Tooltip: a short hover/focus label. Each has different triggers and dismissal rules.' },
  { name: 'Badge vs. Chip vs. Pill vs. Tag', slug: 'badge-chip-pill', keywords: ['badge', 'chip', 'pill', 'tag', 'label', 'شارة'], api: 'Badge', prompt: 'Compact labels distinguished by meaning, shape and interactivity: badge = status/count (not interactive), chip = removable/selectable, pill = shape only, tag = category.' },
  { name: 'Status Dot (Presence Indicator)', slug: 'status-dot', keywords: ['status', 'dot', 'online', 'indicator', 'حالة'], api: '<PresenceBadge status />', prompt: 'A tiny coloured circle saying online/away/busy/error. Never rely on colour alone: pair it with a text label or tooltip.' },
  { name: 'Outline View (Tree)', slug: 'outline-view', keywords: ['tree', 'file tree', 'outline', 'folders', 'شجرة'], api: 'NSOutlineView · role="tree"', prompt: 'An indented tree of rows that expand to reveal nested children, with disclosure triangles, keyboard arrows and a language icon per file.' },
  { name: 'Sidebar (Source List)', slug: 'sidebar', keywords: ['sidebar', 'side panel', 'navigation column', 'لوحة جانبية'], api: 'NavigationSplitView', prompt: 'A navigation column along one edge listing sections and items; collapsible on small screens.' },
  { name: 'Floating Action Button', slug: 'floating-buttons', keywords: ['fab', 'floating', 'add button', '+'], api: 'position: fixed', prompt: 'A round primary-action button floating bottom-corner; one per screen, never covering content.' },
  { name: 'Bottom Navigation (Tab Bar)', slug: 'bottom-navigation', keywords: ['bottom nav', 'tab bar', 'mobile navigation', 'تنقل سفلي'], api: 'UITabBar', prompt: 'Three to five icon+label destinations pinned to the bottom of a phone app; the current one is clearly highlighted.' },
  { name: 'Form Field', slug: 'form-field', keywords: ['form', 'input', 'field', 'label', 'placeholder', 'نموذج', 'حقل'], api: '<label for>', prompt: 'Label above the input, helper text below, a red error line on failure, visible focus ring, never placeholder-as-label.' },
  { name: 'Switch vs. Checkbox vs. Radio', slug: 'switch-checkbox-radio', keywords: ['switch', 'toggle', 'checkbox', 'radio'], api: 'role="switch"', prompt: 'Switch: immediate on/off setting. Checkbox: independent choices. Radio: one choice from a group.' },
  { name: 'Toggle Group (Segmented Control)', slug: 'toggle-group', keywords: ['segmented', 'toggle group', 'filter buttons'], api: 'ToggleGroup', prompt: 'A connected row of compact options with one persistent selection.' },
  { name: 'Resize Handle (Size Grip)', slug: 'resize-handle', keywords: ['resize', 'grip', 'textarea'], api: 'resize', prompt: 'Diagonal lines in a corner that you drag to make a box bigger.' },
  { name: 'Steps', slug: 'steps', keywords: ['steps', 'wizard', 'stepper', 'checkout', 'خطوات'], api: 'aria-current="step"', prompt: 'Numbered circles across the top of a flow, one per stage; completed, current and upcoming states are distinct.' },
  { name: 'Timeline', slug: 'timeline', keywords: ['timeline', 'history', 'log', 'activity', 'سجل'], api: '<Timeline>', prompt: 'A vertical line of dots with one dated event beside each, in the order things happened.' },
];

export const STYLES: UiStyle[] = [
  { name: 'Minimalism', slug: 'minimalism', keywords: ['minimal', 'clean', 'simple', 'بسيط'], signals: ['negative space as material', 'restricted element count', 'limited or monochrome palette'] },
  { name: 'Glassmorphism', slug: 'glassmorphism', keywords: ['glass', 'frosted', 'blur', 'زجاج'], signals: ['frosted translucent panels', 'vivid backdrop showing through', 'thin light edge'] },
  { name: 'Neobrutalism', slug: 'neobrutalism', keywords: ['brutal', 'bold', 'outline'], signals: ['thick black outlines', 'hard offset shadows', 'saturated flat colour blocks'] },
  { name: 'Flat Design', slug: 'flat-design', keywords: ['flat'], signals: ['solid 2D colour fills', 'no simulated depth', 'simple glyph icons'] },
  { name: 'Neumorphism', slug: 'neumorphism', keywords: ['neumorph', 'soft ui'], signals: ['one continuous surface', 'dual soft shadows', 'pressed (inset) states'] },
  { name: 'Claymorphism', slug: 'claymorphism', keywords: ['clay', 'puffy', '3d'], signals: ['two inner shadows + one outer', 'oversized corner radii', 'independently coloured floating objects'] },
  { name: 'Skeuomorphism', slug: 'skeuomorphism', keywords: ['skeuo', 'realistic', 'leather'], signals: ['simulated real materials', 'physical lighting model', 'real-object metaphors'] },
  { name: 'Liquid Glass', slug: 'liquid-glass', keywords: ['liquid glass', 'apple', 'ios 26'], signals: ['glass = the control layer', 'lensing, not just blur', 'adaptive self-tinting'] },
  { name: 'Frutiger Aero', slug: 'frutiger-aero', keywords: ['aero', 'aqua', 'nature'], signals: ['nature fused with tech', 'glossy glass and aqua surfaces', 'sky-blue / grass-green palette'] },
  { name: 'Y2K Digital Aesthetic', slug: 'y2k', keywords: ['y2k', 'chrome', 'retro'], signals: ['liquid chrome and metal', 'gel and glossy plastic', 'iridescent blue-silver palette'] },
  { name: 'Web Brutalism', slug: 'web-brutalism', keywords: ['raw', 'html'], signals: ['browser-default materials', 'exposed document structure', 'zero decorative rendering'] },
];

export interface UiLookupResult {
  terms: UiTerm[];
  style?: UiStyle;
}

function score(keywords: string[], text: string): number {
  let s = 0;
  for (const k of keywords) if (text.includes(k.toLowerCase())) s += k.length > 3 ? 2 : 1;
  return s;
}

const BASELINE = ['header-navbar', 'card', 'form-field', 'empty-state', 'toast'];

/** Offline lookup: scores the description against term keywords. Always returns a useful baseline. */
export function lookupLocal(description: string, max = 8): UiLookupResult {
  const text = description.toLowerCase();
  const scored = TERMS.map((t) => ({ t, s: score(t.keywords, text) + (BASELINE.includes(t.slug) ? 0.5 : 0) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, max)
    .map((x) => x.t);
  const style = STYLES.map((s) => ({ s, sc: score(s.keywords, text) })).sort((a, b) => b.sc - a.sc)[0];
  return { terms: scored, style: style && style.sc > 0 ? style.s : STYLES[0] };
}

const CACHE_PREFIX = 'nthui:';
const TTL = 7 * 24 * 3600 * 1000;

function cacheGet(key: string): string | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < TTL ? v : null;
  } catch {
    return null;
  }
}
function cacheSet(key: string, v: string) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* storage unavailable */
  }
}

/** Extracts the "Prompt — paste into your agent" paragraph from a NameThatUI term page. */
export function extractPrompt(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings = [...doc.querySelectorAll('h2')];
  const h = headings.find((x) => /paste into your agent/i.test(x.textContent ?? ''));
  const p = h?.nextElementSibling?.textContent?.trim();
  return p || null;
}

/** Best-effort live enrichment. Returns the site's own prompt when reachable, otherwise null. */
export async function fetchLivePrompt(term: UiTerm, f: typeof fetch = fetch): Promise<string | null> {
  const cached = cacheGet(term.slug);
  if (cached) return cached;
  try {
    const res = await f(`https://namethatui.com/web/${term.slug}`, { headers: { accept: 'text/html' } });
    if (!res.ok) return null;
    const p = extractPrompt(await res.text());
    if (p) cacheSet(term.slug, p);
    return p;
  } catch {
    return null; // offline or blocked by CORS — the local vocabulary is used
  }
}

/** The "UI vocabulary" block injected into planner / coder / critic prompts. */
export async function uiVocabulary(description: string, opts: { live?: boolean; style?: string } = {}): Promise<{ text: string; terms: string[]; style: string }> {
  const r = lookupLocal(description);
  const style = STYLES.find((s) => s.slug === opts.style || s.name === opts.style) ?? r.style ?? STYLES[0];
  const lines: string[] = [];
  let live = 0;
  for (const t of r.terms) {
    let prompt = t.prompt;
    if (opts.live && live < 3) {
      const p = await fetchLivePrompt(t);
      if (p) { prompt = p; live++; }
    }
    lines.push(`- ${t.name} [${t.api}]: ${prompt}`);
  }
  const text =
    '# UI vocabulary (NameThatUI — name every element with its real term)\n' +
    lines.join('\n') +
    `\n\n# Visual style: ${style.name}\nDefining signals: ${style.signals.join('; ')}.`;
  return { text, terms: r.terms.map((t) => t.name), style: style.name };
}
