// Exporta un HTML (lead magnet) a PDF con el mismo navegador que render.mjs.
// Uso: node .claude/skills/carrusel/pdf.mjs carruseles/NN-slug/lead-magnet/archivo.html
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(globalRoot, 'playwright'));
}

const htmlFile = process.argv[2] && path.resolve(process.argv[2]);
if (!htmlFile || !existsSync(htmlFile)) {
  console.error('Uso: node pdf.mjs <archivo.html>');
  process.exit(1);
}
const out = htmlFile.replace(/\.html$/, '.pdf');

const { chromium } = loadPlaywright();
let browser;
try { browser = await chromium.launch(); } catch {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => { await document.fonts.ready; });
const rotas = await page.evaluate(() => [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src')));
await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
await browser.close();
console.log(`PDF exportado: ${out}`);
for (const r of rotas) console.log(`Revisar: imagen no encontrada ${r}`);
