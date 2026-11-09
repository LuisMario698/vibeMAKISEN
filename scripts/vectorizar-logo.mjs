// Vectoriza el logo de MAKIZEN a SVG a partir de los PNG transparentes de la cartilla
// (1000 × 1000). Separa la capa blanca (pez, luna, MAKIZEN) de la dorada (punto,
// filetes, SUSHI & MARISCOS) y traza cada una con potrace.
// Uso: node scripts/vectorizar-logo.mjs <carpeta-img-cartilla>
import sharp from 'sharp';
import potrace from 'potrace';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('Falta la carpeta con las imágenes extraídas de la cartilla');
const ESCALA = 3; // se traza a 3× para curvas más suaves
const BLANCO = '#FFFFFF';
const ORO = '#AE8B3D';

async function capas(archivo) {
  const { data, info } = await sharp(join(src, archivo)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const blanco = Buffer.alloc(w * h, 255);
  const oro = Buffer.alloc(w * h, 255);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3];
    if (a < 90) continue;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn > 45 && r > b) oro[i] = 255 - a; // dorado
    else if (mn > 150) blanco[i] = 255 - a; // blanco
  }
  return { w, h, blanco, oro };
}

function caja(mask, w, h, filas) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = filas?.[0] ?? 0; y < (filas?.[1] ?? h); y++) for (let x = 0; x < w; x++) {
    if (mask[y * w + x] < 128) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return { x0, y0, x1, y1 };
}

async function trazar(mask, w, h, recorte) {
  const { x0, y0, x1, y1 } = recorte;
  const png = await sharp(mask, { raw: { width: w, height: h, channels: 1 } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize({ width: (x1 - x0 + 1) * ESCALA, kernel: 'lanczos3' })
    .png().toBuffer();
  return new Promise((ok, mal) => {
    const t = new potrace.Potrace({ threshold: 128, turdSize: 6 * ESCALA, optTolerance: 0.6, alphaMax: 1 });
    t.loadImage(png, (err) => {
      if (err) return mal(err);
      const d = (t.getPathTag().match(/ d="([^"]+)"/)?.[1] ?? '').replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));
      ok(d);
    });
  });
}

async function svg(archivo, salida, filas) {
  const { w, h, blanco, oro } = await capas(archivo);
  const cb = caja(blanco, w, h, filas), co = caja(oro, w, h, filas);
  const r = { x0: Math.min(cb.x0, co.x1 >= 0 ? co.x0 : w), y0: Math.min(cb.y0, co.y1 >= 0 ? co.y0 : h), x1: Math.max(cb.x1, co.x1), y1: Math.max(cb.y1, co.y1) };
  const pad = 8;
  r.x0 = Math.max(0, r.x0 - pad); r.y0 = Math.max(0, r.y0 - pad); r.x1 = Math.min(w - 1, r.x1 + pad); r.y1 = Math.min(h - 1, r.y1 + pad);
  // Fuera de las filas pedidas, la máscara queda vacía.
  if (filas) for (const m of [blanco, oro]) for (let y = 0; y < h; y++) if (y < filas[0] || y >= filas[1]) m.fill(255, y * w, (y + 1) * w);
  const [dB, dO] = await Promise.all([trazar(blanco, w, h, r), trazar(oro, w, h, r)]);
  const vw = r.x1 - r.x0 + 1, vh = r.y1 - r.y0 + 1;
  const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" role="img" aria-label="MAKIZEN Sushi &amp; Mariscos"><g transform="scale(${1 / ESCALA})"><path fill="${BLANCO}" fill-rule="evenodd" d="${dB}"/>${dO ? `<path fill="${ORO}" fill-rule="evenodd" d="${dO}"/>` : ''}</g></svg>\n`;
  writeFileSync(`public/brand/${salida}.svg`, out);
  console.log(`${salida}.svg ${vw}×${vh} · ${(out.length / 1024).toFixed(1)} KB`);
  return { vw, vh };
}

// Isotipo: solo la parte de arriba del lockup vertical (antes del wordmark).
const { h, blanco } = await capas('img752_1000x1000.png');
const filasConTinta = [];
for (let y = 0; y < h; y++) { let n = 0; for (let x = 0; x < 1000; x++) if (blanco[y * 1000 + x] < 128) n++; filasConTinta.push(n); }
let finIso = 0; let vacio = 0;
for (let y = 0; y < h; y++) {
  if (filasConTinta[y] === 0) { vacio++; if (vacio > 12 && finIso === 0 && y > 200) { finIso = y - vacio + 1; } } else vacio = 0;
}
await svg('img752_1000x1000.png', 'logo-vertical');
await svg('img910_1000x1000.png', 'logo-horizontal');
await svg('img752_1000x1000.png', 'isotipo', [0, finIso || 640]);

// Íconos de la app (PWA) y favicon a partir del isotipo vectorial, sobre negro.
import { readFileSync } from 'node:fs';
const iso = readFileSync('public/brand/isotipo.svg');
for (const [lado, nombre] of [[192, 'icon-192'], [512, 'icon-512'], [180, 'apple-touch-icon']]) {
  const dentro = Math.round(lado * 0.62);
  const marca = await sharp(iso, { density: 600 }).resize({ width: dentro, height: dentro, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await sharp({ create: { width: lado, height: lado, channels: 4, background: '#000000' } })
    .composite([{ input: marca, gravity: 'center' }]).png().toFile(`public/brand/${nombre}.png`);
}
console.log('íconos listos');
