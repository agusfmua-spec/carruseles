// Exporta cada <section class="slide"> de slides.html a un PNG.
// Uso: node .claude/skills/carrusel/render.mjs carruseles/NN-slug [--html otro.html]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch {}
  const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
  return require(path.join(globalRoot, 'playwright'));
}

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--'));
if (!dir) {
  console.error('Uso: node render.mjs <carpeta-del-carrusel> [--html slides.html]');
  process.exit(1);
}
const htmlIdx = args.indexOf('--html');
const htmlFile = path.resolve(dir, htmlIdx >= 0 ? args[htmlIdx + 1] : 'slides.html');
if (!existsSync(htmlFile)) {
  console.error(`No existe ${htmlFile}`);
  process.exit(1);
}
const outDir = path.resolve(dir, 'png');
if (existsSync(outDir)) {
  for (const f of readdirSync(outDir)) if (f.endsWith('.png')) rmSync(path.join(outDir, f));
} else {
  mkdirSync(outDir, { recursive: true });
}

const { chromium } = loadPlaywright();
let browser;
try {
  browser = await chromium.launch();
} catch {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
}

const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map((img) =>
    img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
});

const tam = await page.evaluate(() => {
  const s = document.querySelector('.slide');
  return s ? { width: s.offsetWidth, height: s.offsetHeight } : null;
});
if (tam) await page.setViewportSize(tam);

const problemas = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('img').forEach((img) => {
    if (!img.naturalWidth) out.push(`Imagen no encontrada: ${img.getAttribute('src')}`);
  });
  document.querySelectorAll('.slide').forEach((s, i) => {
    const caja = s.getBoundingClientRect();
    const c = s.querySelector('.contenido')?.getBoundingClientRect();
    const pie = s.querySelector('.pie')?.getBoundingClientRect();
    if (!c) return;
    if (c.top < caja.top || c.bottom > caja.bottom || c.right > caja.right + 1) {
      out.push(`Slide ${i + 1}: el texto se sale de la slide (acortalo o bajá el tamaño)`);
    } else if (pie && c.bottom > pie.top) {
      out.push(`Slide ${i + 1}: el texto se pisa con el pie`);
    }
  });
  const familias = new Set();
  document.fonts.forEach((f) => { if (f.status === 'error') familias.add(f.family); });
  familias.forEach((f) => out.push(`No se pudo cargar la fuente ${f}`));
  return out;
});

const slides = await page.$$('.slide');
for (let i = 0; i < slides.length; i++) {
  const file = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
  await slides[i].screenshot({ path: file });
}
await browser.close();

console.log(`${slides.length} slides exportadas en ${outDir}`);
if (problemas.length) {
  console.log('Revisar:');
  for (const p of [...new Set(problemas)]) console.log(`- ${p}`);
}
