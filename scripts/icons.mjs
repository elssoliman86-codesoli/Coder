// Renders public/favicon.svg to the PNG icons the PWA manifest needs.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const b = await chromium.launch();
for (const size of [192, 512]) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<body style="margin:0">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
  await p.screenshot({ path: new URL(`../public/icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: true });
}
await b.close();
