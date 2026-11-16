// Variantes ligeras de las imágenes del menú, para que las tarjetas se vean al instante en el teléfono.
// Uso: node scripts/miniaturas.mjs   (después de scripts/prepare-assets.mjs y prepare-fotos-redes.mjs)
//
// - Recortes de la cartilla (public/menu/<id>.webp, con alfa, ~560 px): anchos 240 y 360 px en
//   public/menu/v/ para pantallas de densidad 1–2 (el original sigue como la opción más grande, así en
//   un teléfono de densidad 3 la tarjeta y el detalle comparten la misma imagen ya descargada).
// - Un LQIP diminuto en línea (≈ 200 B) que se ve mientras llega la imagen: nunca un hueco.
// - La sombra del platillo pre-renderizada: la silueta difuminada, en línea (≈ 300 B). Sustituye a
//   filter: drop-shadow() en cada imagen, que obligaba a volver a pintar el filtro al hacer scroll.
// - Fotos reales (fotos-redes.json): LQIP en línea para tarjetas, cabeceras y el mosaico.
// Escribe src/data/miniaturas.json.
import sharp from 'sharp';
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const ANCHOS = [240, 360];
// Sombra: equivale a drop-shadow(0 18px 16px rgb(0 0 0 / 0.75)) sobre un platillo de ~145 px.
const D = 64; // lado mayor del platillo en la imagen de la sombra
const PAD = Math.round(D * 0.3); // margen para el desenfoque y el desplazamiento
const DY = Math.round(D * 0.124); // desplazamiento hacia abajo
const SIGMA = D * 0.055; // desenfoque (σ = radio / 2)
const ALFA = 0.75;

const uri = (buf) => `data:image/webp;base64,${buf.toString('base64')}`;
const salida = { sombraEscala: +((D + 2 * PAD) / D).toFixed(4), recortes: {}, fotos: {} };

rmSync('public/menu/v', { recursive: true, force: true });
mkdirSync('public/menu/v', { recursive: true });

for (const f of readdirSync('public/menu').filter((x) => x.endsWith('.webp')).sort()) {
  const id = f.slice(0, -5);
  const src = `public/menu/${f}`;
  const { width: w, height: h } = await sharp(src).metadata();
  const anchos = [];
  for (const a of ANCHOS) {
    if (a > w * 0.85) continue;
    await sharp(src).resize({ width: a }).webp({ quality: 80, alphaQuality: 82, effort: 6, smartSubsample: true }).toFile(`public/menu/v/${id}-${a}.webp`);
    anchos.push(a);
  }
  // LQIP: 20 px por el lado mayor, ligeramente difuminado para que se lea como «cargando».
  const lado = w >= h ? { width: 20 } : { height: 20 };
  const lqip = await sharp(src).resize(lado).blur(0.6).webp({ quality: 55, alphaQuality: 60, effort: 6 }).toBuffer();
  // Sombra: silueta (alfa) desplazada y difuminada en un lienzo con margen uniforme; así queda
  // centrada igual que el platillo y basta con escalar su caja por sombraEscala.
  const peq = await sharp(src).resize(D, D, { fit: 'inside' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: ws, height: hs } = peq.info;
  const W = ws + 2 * PAD, H = hs + 2 * PAD;
  // Lienzo cuadrado (D + 2·PAD) para que background-size: contain coincida con el platillo.
  const L = D + 2 * PAD;
  const ox = Math.round((L - W) / 2) + PAD, oy = Math.round((L - H) / 2) + PAD + DY;
  const mascara = Buffer.alloc(L * L);
  for (let y = 0; y < hs; y++) for (let x = 0; x < ws; x++) {
    const yy = y + oy, xx = x + ox;
    if (yy >= 0 && yy < L && xx >= 0 && xx < L) mascara[yy * L + xx] = Math.round(peq.data[(y * ws + x) * 4 + 3] * ALFA);
  }
  const borrosa = await sharp(mascara, { raw: { width: L, height: L, channels: 1 } }).blur(SIGMA).raw().toBuffer();
  const rgba = Buffer.alloc(L * L * 4);
  for (let i = 0; i < L * L; i++) rgba[i * 4 + 3] = borrosa[i];
  const sombra = await sharp(rgba, { raw: { width: L, height: L, channels: 4 } }).webp({ quality: 60, alphaQuality: 70, effort: 6 }).toBuffer();
  salida.recortes[id] = { w, h, anchos, lqip: uri(lqip), sombra: uri(sombra) };
}

const redes = JSON.parse(readFileSync('src/data/fotos-redes.json', 'utf8'));
for (const [id, t] of Object.entries(redes)) {
  const lqip = await sharp(`public/fotos/${id}-${t.anchos[0]}.webp`).resize({ width: 24 }).blur(0.5).webp({ quality: 50, effort: 6 }).toBuffer();
  salida.fotos[id] = { lqip: uri(lqip) };
}

writeFileSync('src/data/miniaturas.json', JSON.stringify(salida, null, 1) + '\n');
const kb = (o) => (Object.values(o).reduce((a, x) => a + (x.lqip?.length ?? 0) + (x.sombra?.length ?? 0), 0) / 1024).toFixed(1);
console.log(`miniaturas: ${Object.keys(salida.recortes).length} recortes (${kb(salida.recortes)} KB en línea), ${Object.keys(salida.fotos).length} fotos (${kb(salida.fotos)} KB en línea)`);
