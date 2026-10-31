import type { Role, Skill } from '../types';

const ALL = ['website', 'apk', 'cli', 'exe', 'library'];
const UI = ['website', 'apk', 'exe'];

function skill(
  name: string,
  description: string,
  appliesTo: string[],
  triggers: string[],
  always: boolean,
  agents: Role[] | undefined,
  body: string,
): Skill {
  return { name, description, appliesTo, triggers, always, agents, enabled: true, builtin: true, body: body.trim() };
}

export const BUILTIN_SKILLS: Skill[] = [
  skill(
    'requirements-understanding',
    'Turn a free-text description into concrete engineering decisions (files, languages, database, libraries, structure, tests).',
    ALL,
    [],
    true,
    ['planner'],
    `
You are not allowed to start from a template. Read the description twice and extract: the product goal, the users, every feature (explicit and implied), data that must be stored, integrations, and the target platform.
Decide, and justify each decision in one sentence:
1. Project type: website | apk | cli | exe | library.
2. Number of files: as few as keep every file focused (one responsibility). A small tool is 3-8 files, a real product 12-30. Never one giant file, never 100 tiny ones.
3. Language per part. Prefer the language the target runtime runs natively (browser → HTML/CSS/JS or TypeScript, Android → web app wrapped by Capacitor unless native is required, CLI → Python or Go, desktop → the same language as the logic).
4. Database: none if localStorage/IndexedDB is enough; SQLite for single-user local data; PostgreSQL only when there is a server and multiple users. Say why.
5. Libraries: choose the smallest set. Do NOT invent version numbers. If you cannot verify a version, write "latest" and mark it unverified. Prefer the platform's built-in APIs before adding a dependency.
6. Folder structure, entry point, how to run, how to test.
7. Open questions and assumptions: list anything ambiguous and state the assumption you made.
Every function that will be needed must appear in the function inventory with its signature and the other functions it calls.`,
  ),
  skill(
    'ui-reference-namethatui',
    'Use the NameThatUI visual dictionary to name every UI element and pick a visual style before writing UI code.',
    UI,
    [],
    true,
    ['planner', 'coder', 'critic', 'fixer'],
    `
Before writing any UI, name each element with its real UI term (Hamburger Menu / Nav Drawer, Card, Bento Grid, Toast, Command Palette, Empty State, Skeleton, Data Table, Tabs, Popover, Modal Dialog vs Drawer vs Sheet, Badge vs Chip vs Pill, Breadcrumbs, Stepper...). Use the "UI vocabulary" block given to you: it lists the real name, the API symbol and the paste-ready prompt for each relevant term.
Pick ONE visual style from the styles atlas (Minimalism, Glassmorphism, Neobrutalism, Flat Design, Neumorphism, Claymorphism, Skeuomorphism, Liquid Glass, Frutiger Aero, Aqua, Y2K...) and follow its defining signals consistently. Do not mix styles by accident.
Record the terms and the style you used in design-notes.md (term → where it is used → file).`,
  ),
  skill(
    'web-frontend-pro',
    'Professional front-end structure, visual polish and responsive layout for websites.',
    ['website', 'apk'],
    ['website', 'site', 'web', 'landing', 'dashboard', 'portfolio', 'store', 'shop', 'ui', 'design', 'موقع', 'صفحة', 'متجر', 'تصميم', 'واجهة', 'لوحة'],
    false,
    ['planner', 'coder', 'critic', 'fixer'],
    `
Structure: semantic HTML (header, nav, main, section, footer), one stylesheet with CSS custom properties for colour, spacing, radius, shadow and type scale (design tokens), no inline styles, no magic numbers.
Layout: mobile-first, CSS grid/flex, fluid type with clamp(), a consistent 4/8px spacing scale, a max content width, sticky header only when it earns its place.
Polish: a restrained palette (1 accent + neutrals), real hierarchy (size/weight/contrast), 150-250ms easing on hover/focus, visible :focus-visible rings, empty/loading/error states for every data view, no two controls touching (min 8px gap), touch targets >= 44px.
Never ship lorem ipsum, broken placeholders or a default browser look.`,
  ),
  skill(
    'web-backend-pro',
    'Backend design: API contract, validation, storage, errors and security basics.',
    ['website', 'apk', 'cli', 'exe', 'library'],
    ['api', 'backend', 'server', 'database', 'login', 'auth', 'users', 'admin', 'سيرفر', 'قاعدة بيانات', 'تسجيل دخول', 'مستخدمين', 'لوحة تحكم'],
    false,
    ['planner', 'coder'],
    `
Define the API contract first (method, path, request, response, errors). Validate every input at the boundary. Return consistent error shapes with proper status codes.
Never build SQL by string concatenation; use parameters. Hash passwords with a slow KDF (argon2/bcrypt/scrypt), never store secrets in code, read them from environment variables, and ship an .env.example.
Keep business logic out of route handlers. Add pagination to list endpoints. Log errors without leaking secrets.`,
  ),
  skill(
    'mobile-app-pro',
    'Mobile app structure and UX for APK targets (Capacitor / web-based apps).',
    ['apk'],
    ['apk', 'android', 'mobile', 'app', 'تطبيق', 'موبايل', 'أندرويد', 'اندرويد'],
    false,
    ['planner', 'coder', 'critic', 'fixer'],
    `
Build the app as a mobile-first web app (index.html + modules) that works inside a WebView: viewport-fit=cover, safe-area insets (env(safe-area-inset-*)), no hover-only interactions, touch targets >= 44px, bottom navigation (3-5 items) for primary sections, sheets instead of centred modals on phones.
Persist data with localStorage/IndexedDB, handle offline, and never depend on a desktop-only API. Keep the first screen useful within one second (skeletons, not spinners).
The app must be installable: manifest, icons, theme colour, a sensible app name.`,
  ),
  skill(
    'cli-pro',
    'Command-line tools: arguments, exit codes, help and testability.',
    ['cli', 'library'],
    ['cli', 'command', 'terminal', 'script', 'tool', 'سكريبت', 'أداة', 'سطر أوامر', 'تيرمنال'],
    false,
    ['planner', 'coder'],
    `
Use the standard argument parser of the language (argparse / click / cobra / commander). Provide --help, --version, clear errors on stderr and meaningful exit codes (0 ok, 1 error, 2 usage).
Separate pure logic from I/O so it can be unit-tested. Read stdin when it makes sense, support --json output for machines, and never print secrets.`,
  ),
  skill(
    'desktop-app-pro',
    'Desktop (exe) apps: shell choice, packaging and native feel.',
    ['exe'],
    ['desktop', 'exe', 'windows', 'electron', 'tauri', 'سطح المكتب', 'ويندوز', 'برنامج'],
    false,
    ['planner', 'coder'],
    `
Pick the lightest shell that fits (Tauri or a native toolkit before Electron, unless the team knows the web stack). Separate the UI layer from the logic layer; the logic must run headless for tests.
Define the packaging path from day one (PyInstaller, dotnet publish, Tauri/Electron builder) and the CI job that produces the .exe.`,
  ),
  skill(
    'visual-qa',
    'Review rendered output like a designer: layout, colour, hierarchy, consistency.',
    UI,
    [],
    true,
    ['critic'],
    `
Judge what is on screen, not what the code intends. Collect EVERY problem in one pass, with element, file and severity:
- controls touching or overlapping, misaligned edges, uneven gaps;
- weak contrast, too many colours, inconsistent radius/shadow/typography;
- no visual hierarchy, walls of text, empty-looking screens;
- unprofessional structure (default browser styling, unstyled forms, inline styles);
- RTL mistakes (wrong alignment, mirrored icons that should not mirror).
Compare against the original description and design notes: is every requested feature visible and usable? Be specific: "the two buttons in .actions have 0px gap" not "spacing is bad".`,
  ),
  skill(
    'code-quality',
    'Clean, consistent, maintainable code.',
    ALL,
    [],
    true,
    ['coder', 'fixer', 'expert'],
    `
One responsibility per file and per function. Descriptive names, no dead code, no commented-out code, no duplicated blocks, no unused imports/variables. Handle errors explicitly at boundaries. Keep functions short enough to read in one screen. Add comments only where the "why" is not obvious. Consistent formatting and quote style across all files.`,
  ),
  skill(
    'security-audit',
    'Find and fix vulnerabilities before publishing.',
    ALL,
    [],
    true,
    ['expert'],
    `
Check: hard-coded secrets and tokens; injection (SQL, command, template); XSS (innerHTML/document.write with untrusted data, missing escaping); SSRF and open redirects; path traversal; unsafe deserialisation / eval / Function; weak crypto and hashing; missing authentication/authorisation; insecure CORS; missing CSP for websites; dependency risks (unpinned or abandoned packages); Android: cleartext traffic, exported components, excessive permissions (MANAGE_EXTERNAL_STORAGE, READ_SMS ...).
Report each finding with file, line/area, severity and a concrete fix. Apply the fixes you can. Anything unresolved is a blocker.`,
  ),
  skill(
    'testing',
    'Tests that prove the behaviour.',
    ALL,
    [],
    true,
    ['planner', 'coder', 'expert'],
    `
Every pure function in the inventory gets a unit test (happy path, edge case, error). Use the standard runner of the language (node:test, pytest, go test...). Tests must be runnable with one command documented in the README. No test may depend on the network or the clock without stubbing it.`,
  ),
  skill(
    'git-and-release',
    'Repository hygiene and release workflow.',
    ALL,
    [],
    true,
    ['expert'],
    `
The repository needs: README, LICENSE, .gitignore, a CI workflow, no build output or secrets committed, meaningful commit messages, semantic versions (vMAJOR.MINOR.PATCH). Websites deploy to GitHub Pages; Android projects publish an APK to a GitHub Release; desktop projects publish the executable; CLIs publish packaged sources/binaries.`,
  ),
  skill(
    'readme-writer',
    'A README people can actually follow.',
    ALL,
    [],
    true,
    ['expert'],
    `
Sections: what it is (one paragraph), features, screenshots or a usage example, install, run, build, test, configuration (env vars), project structure, licence. Commands must be copy-pasteable and correct for THIS project. Write it in the language of the project description (Arabic if the description is Arabic) with English technical terms.`,
  ),
  skill(
    'accessibility',
    'WCAG 2.2 AA baseline.',
    UI,
    [],
    true,
    ['coder', 'critic', 'fixer'],
    `
Contrast >= 4.5:1 for text (3:1 for large text and UI borders). Every control reachable and operable by keyboard with a visible :focus-visible ring. Inputs have labels; images have alt; icon-only buttons have aria-label. Touch targets >= 44x44px. Respect prefers-reduced-motion. Do not rely on colour alone to convey state. Landmarks and a logical heading order.`,
  ),
  skill(
    'performance',
    'Fast by default.',
    UI,
    [],
    true,
    ['coder', 'expert'],
    `
No blocking scripts in <head> (defer/module), no layout thrash, images sized and lazy-loaded, no unbounded lists (paginate or virtualise), debounce expensive handlers, avoid heavy dependencies for small features, cache what is expensive to compute.`,
  ),
  skill(
    'arabic-rtl',
    'Right-to-left layout, Arabic typography and bidi text.',
    UI,
    ['arabic', 'rtl', 'عربي', 'عربية', 'بالعربي', 'العربية'],
    false,
    ['planner', 'coder', 'critic', 'fixer'],
    `
Set <html lang="ar" dir="rtl">. Use logical CSS properties (margin-inline-start, padding-inline-end, inset-inline-start, text-align:start) instead of left/right. Mirror directional icons (arrows, chevrons) but not logos, media controls or numerals. Use an Arabic-capable font stack (e.g. "IBM Plex Sans Arabic", "Noto Sans Arabic", system-ui) with line-height >= 1.6. Wrap embedded LTR snippets (code, URLs, English names) with dir="ltr" or <bdi>. Keep code, file names and identifiers LTR.`,
  ),
  skill(
    'web-visual-polish',
    'Refine layout, colour, spacing and motion of an existing UI.',
    ['website', 'apk', 'exe'],
    ['polish', 'redesign', 'ugly', 'professional', 'تحسين', 'احترافي', 'شكل', 'ألوان', 'الوان'],
    false,
    ['critic', 'fixer'],
    `
Fix systematically, not cosmetically: define/clean the design tokens first (colour, spacing, radius, shadow, type scale), then apply them everywhere. Establish hierarchy with size, weight and whitespace. Replace one-off values with tokens. Align everything to one grid. Make states consistent (hover, focus, active, disabled, loading, empty, error).`,
  ),
];

export const BUILTIN_NAMES = new Set(BUILTIN_SKILLS.map((s) => s.name));
