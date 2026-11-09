// Fotos reales de @makizen.puertopenasco en su resolución original de Instagram
// (fotos 1080 × 1350 y cuadros de reel 1080 × 1920). Se recortan los textos de las
// plantillas de Canva y los subtítulos de los reels; se generan WebP en 2 anchos.
// Uso: node scripts/prepare-fotos-redes.mjs <carpeta-con-originales>
import sharp from 'sharp';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('Falta la carpeta con los originales');
rmSync('public/fotos', { recursive: true, force: true });
mkdirSync('public/fotos', { recursive: true });

const ANCHOS = [640, 1080];
/** [salida, archivo, recorte (px del original) | null, origen] */
const fotos = [
  ['mesa-cenital', 'mkz-mesa-cenital.png', { left: 0, top: 0, width: 1080, height: 1030 }, 'IG · carrusel "El antojo tiene otra forma" (29 oct)'],
  ['sashimi', 'mkz-mesa-cenital.png', { left: 470, top: 70, width: 560, height: 560 }, 'IG · carrusel (29 oct)'],
  ['gin-pepino', 'mkz-mesa-cenital.png', { left: 85, top: 285, width: 345, height: 345 }, 'IG · carrusel (29 oct)'],
  ['rollo-corona', 'mkz-el-antojo.jpg', { left: 0, top: 175, width: 1080, height: 980 }, 'IG · carrusel (29 oct)'],
  ['bocado', 'mkz-el-placer.png', { left: 520, top: 700, width: 560, height: 600 }, 'IG · carrusel (29 oct)'],
  ['serrano', 'mkz-un-bocado.png', { left: 0, top: 520, width: 1080, height: 610 }, 'IG · carrusel (29 oct)'],
  ['serrano-palillos', 'mkz-un-bocado.png', { left: 0, top: 0, width: 470, height: 1130 }, 'IG · carrusel (29 oct)'],
  ['mas-sabores', 'mkz-mas-sabores.png', { left: 0, top: 300, width: 1080, height: 1050 }, 'IG · carrusel (29 oct)'],
  ['fachada-noche', 'mkz-fachada-noche.png', { left: 0, top: 270, width: 1350, height: 600 }, 'IG · Halloween (31 oct)'],
  ['fachada-frente', 'mkz-fachada-atardecer-2.png', { left: 0, top: 300, width: 1080, height: 1180 }, 'IG · reel de apertura (8 oct)'],
  ['fachada-lado', 'mkz-fachada-atardecer.png', { left: 0, top: 150, width: 1080, height: 1300 }, 'IG · reel de apertura (8 oct)'],
  ['muro-coctel', 'mkz-muro-logo.png', null, 'IG · reel'],
  ['muro-logo', 'mkz-muro-logo-2.png', { left: 0, top: 0, width: 1080, height: 1680 }, 'IG · reel'],
  ['aguachile', 'mkz-aguachile.png', { left: 0, top: 160, width: 1080, height: 1500 }, 'IG · reel'],
  ['makizen-roll', 'mkz-makizen-roll.png', { left: 0, top: 180, width: 1080, height: 1560 }, 'IG · reel'],
  ['rollos-plato', 'mkz-sinaloa-roll.png', { left: 0, top: 120, width: 1080, height: 1500 }, 'IG · reel'],
  ['udon', 'mkz-udon.png', { left: 400, top: 680, width: 680, height: 790 }, 'IG · reel de apertura (8 oct)'],
];

const tam = {};
for (const [salida, archivo, recorte, origen] of fotos) {
  const base = sharp(join(src, archivo));
  const meta = await (recorte ? base.clone().extract(recorte) : base.clone()).toBuffer({ resolveWithObject: true });
  const w0 = meta.info.width, h0 = meta.info.height;
  const anchos = ANCHOS.filter((a) => a < w0).concat(Math.min(w0, 1080)).filter((v, i, a) => a.indexOf(v) === i);
  for (const a of anchos) {
    await sharp(meta.data).resize({ width: a }).sharpen({ sigma: 0.5 }).webp({ quality: 82, effort: 6, smartSubsample: true }).toFile(`public/fotos/${salida}-${a}.webp`);
  }
  tam[salida] = { w: w0, h: h0, anchos, origen };
}
writeFileSync('src/data/fotos-redes.json', JSON.stringify(tam, null, 2) + '\n');
console.log(Object.entries(tam).map(([k, v]) => `${k} ${v.w}x${v.h} [${v.anchos}]`).join('\n'));
