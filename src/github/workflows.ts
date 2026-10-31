import type { Project, ProjectFile } from '../types';
import { slugify } from '../lib/util';

export const PAGES_WORKFLOW = `name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Collect site files
        run: |
          mkdir -p _site
          rsync -a --exclude '.git' --exclude '.github' --exclude '_site' --exclude 'node_modules' ./ _site/
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site
      - id: deployment
        uses: actions/deploy-pages@v4
`;

export const APK_WORKFLOW = `name: Build APK
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  apk:
    runs-on: ubuntu-latest
    timeout-minutes: 40
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - uses: android-actions/setup-android@v3
      - name: Prepare web assets
        run: |
          rm -rf www && mkdir www
          rsync -a --exclude '.git' --exclude '.github' --exclude 'www' --exclude 'node_modules' --exclude 'android' ./ www/
      - name: Install Capacitor and create the Android project
        run: |
          npm init -y >/dev/null 2>&1 || true
          npm install @capacitor/core @capacitor/cli @capacitor/android
          cat > capacitor.config.json <<'JSON'
          { "appId": "__APP_ID__", "appName": "__APP_NAME__", "webDir": "www" }
          JSON
          npx cap add android
          npx cap sync android
      - name: Build debug APK
        working-directory: android
        run: ./gradlew assembleDebug --no-daemon
      - name: Collect APK
        run: |
          mkdir -p out
          cp android/app/build/outputs/apk/debug/app-debug.apk "out/__APK_NAME__.apk"
      - uses: actions/upload-artifact@v4
        with:
          name: apk
          path: out/*.apk
      - name: Publish release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: build-\${{ github.run_number }}
          name: __APP_NAME__ build \${{ github.run_number }}
          files: out/*.apk
`;

export const EXE_PY_WORKFLOW = `name: Build EXE
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  exe:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - run: |
          python -m pip install --upgrade pip pyinstaller
          if (Test-Path requirements.txt) { pip install -r requirements.txt }
          pyinstaller --onefile --name "__APK_NAME__" "__ENTRY__"
      - uses: actions/upload-artifact@v4
        with:
          name: exe
          path: dist/*.exe
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: build-\${{ github.run_number }}
          name: __APP_NAME__ build \${{ github.run_number }}
          files: dist/*.exe
`;

export const CLI_WORKFLOW = `name: Package
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: write
jobs:
  package:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Package sources
        run: |
          mkdir -p out
          tar --exclude='.git' --exclude='.github' --exclude='out' -czf "out/__APK_NAME__.tar.gz" .
      - uses: actions/upload-artifact@v4
        with:
          name: package
          path: out/*.tar.gz
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: build-\${{ github.run_number }}
          name: __APP_NAME__ build \${{ github.run_number }}
          files: out/*.tar.gz
`;

export const LIBRARY_WORKFLOW = `name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Smoke check
        run: |
          echo "Repository checked out"
          ls -la
`;

function fill(t: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`__${k}__`).join(v), t);
}

export function appId(name: string): string {
  const slug = slugify(name).replace(/-/g, '');
  const safe = /^[a-z]/.test(slug) ? slug : 'app' + slug;
  return `com.onebyte.${safe}`.slice(0, 80);
}

export interface WorkflowFile extends ProjectFile {
  triggersBuild: boolean;
}

/** The workflow file(s) a project of this type needs. Never overwrites a workflow the project already has. */
export function workflowsFor(p: Project): WorkflowFile[] {
  if (p.files.some((f) => f.path.startsWith('.github/workflows/'))) return [];
  const name = p.name.replace(/["\\\n]/g, '').trim() || 'App';
  const slug = slugify(name);
  const vars = { APP_ID: appId(name), APP_NAME: name, APK_NAME: slug, ENTRY: p.files.find((f) => /(^|\/)(main|app|cli|__main__)\.py$/.test(f.path))?.path ?? 'main.py' };
  switch (p.type) {
    case 'website':
      return [{ path: '.github/workflows/pages.yml', content: PAGES_WORKFLOW, triggersBuild: true }];
    case 'apk':
      return [{ path: '.github/workflows/build-apk.yml', content: fill(APK_WORKFLOW, vars), triggersBuild: true }];
    case 'exe':
      return p.primaryLanguage === 'python'
        ? [{ path: '.github/workflows/build-exe.yml', content: fill(EXE_PY_WORKFLOW, vars), triggersBuild: true }]
        : [{ path: '.github/workflows/package.yml', content: fill(CLI_WORKFLOW, vars), triggersBuild: true }];
    case 'cli':
      return [{ path: '.github/workflows/package.yml', content: fill(CLI_WORKFLOW, vars), triggersBuild: true }];
    default:
      return [{ path: '.github/workflows/ci.yml', content: LIBRARY_WORKFLOW, triggersBuild: false }];
  }
}

export const GITIGNORE = `node_modules/
dist/
build/
.env
.env.*
!.env.example
*.keystore
*.jks
*.pem
__pycache__/
*.pyc
.DS_Store
`;

export const MIT_LICENSE = (holder: string, year: number) => `MIT License

Copyright (c) ${year} ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export function fallbackReadme(p: Project): string {
  const run =
    p.type === 'website' || p.type === 'apk'
      ? 'افتح `index.html` في المتصفح (أو انشره على GitHub Pages).'
      : p.primaryLanguage === 'python'
        ? 'شغّل: `python main.py`'
        : 'راجع ملفات المشروع لنقطة الدخول.';
  return `# ${p.name}\n\n${p.plan?.summary ?? p.description}\n\n## التشغيل\n\n${run}\n\n## هيكل المشروع\n\n${p.files.map((f) => `- \`${f.path}\``).join('\n')}\n\n---\nتم إنشاء المشروع بواسطة 2OneByte-Coder.\n`;
}
