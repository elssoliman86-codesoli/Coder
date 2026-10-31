// Build script: bundles src/main.tsx with esbuild, copies public/ and index.html into dist/.
import { build, context } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const watch = process.argv.includes('--watch');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

const options = {
  entryPoints: [join(root, 'src/main.tsx')],
  bundle: true,
  outdir: join(dist, 'assets'),
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  entryNames: 'app',
  loader: { '.svg': 'dataurl' },
  define: {
    'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'),
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  logLevel: 'info',
};

async function prepare() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  if (existsSync(join(root, 'public'))) await cp(join(root, 'public'), dist, { recursive: true });
  let html = await readFile(join(root, 'index.html'), 'utf8');
  html = html.replace('%APP_VERSION%', pkg.version);
  await writeFile(join(dist, 'index.html'), html);
}

await prepare();

if (!watch) {
  await build(options);
  console.log('built → dist/');
} else {
  const ctx = await context(options);
  await ctx.watch();
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
  createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let file = normalize(join(dist, url.pathname === '/' ? 'index.html' : url.pathname));
    if (!file.startsWith(dist)) { res.writeHead(403).end(); return; }
    try {
      const data = await readFile(file);
      res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(data);
    } catch {
      res.writeHead(200, { 'content-type': 'text/html' }).end(await readFile(join(dist, 'index.html')));
    }
  }).listen(5173, () => console.log('dev server: http://localhost:5173'));
}
