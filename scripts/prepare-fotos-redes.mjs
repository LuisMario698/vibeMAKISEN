// Recorta y optimiza las capturas tomadas de las publicaciones y reels de
// @makizen.puertopenasco (Instagram). Quita los textos de las plantillas de Canva
// y los subtítulos de los reels para usar solo la fotografía.
// Uso: node scripts/prepare-fotos-redes.mjs <carpeta-con-capturas>
import sharp from 'sharp';
import { join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

const src = process.argv[2];
if (!src) throw new Error('Falta la carpeta con las capturas');
mkdirSync('public/fotos', { recursive: true });

/** [archivo, salida, recorte {left, top, width, height} | null, ancho final, origen] */
const fotos = [
  ['mesa-cenital.png', 'mesa-cenital', { left: 0, top: 0, width: 980, height: 930 }, 1100, 'IG · carrusel "El antojo tiene otra forma" (29 oct)'],
  ['mesa-cenital.png', 'sashimi-real', { left: 430, top: 70, width: 510, height: 490 }, 640, 'IG · carrusel (29 oct)'],
  ['mesa-cenital.png', 'gin-pepino-real', { left: 80, top: 260, width: 310, height: 310 }, 420, 'IG · carrusel (29 oct)'],
  ['el-antojo.png', 'rollos-corona', { left: 0, top: 160, width: 980, height: 880 }, 1000, 'IG · carrusel (29 oct)'],
  ['un-bocado.png', 'serrano-palillos', { left: 0, top: 0, width: 440, height: 1224 }, 520, 'IG · carrusel (29 oct)'],
  ['un-bocado.png', 'serrano-real', { left: 0, top: 500, width: 980, height: 560 }, 1000, 'IG · carrusel (29 oct)'],
  ['el-placer.png', 'bocado-detalle', { left: 470, top: 640, width: 510, height: 520 }, 800, 'IG · carrusel (29 oct)'],
  ['mas-sabores.png', 'mas-sabores', { left: 0, top: 270, width: 980, height: 954 }, 1000, 'IG · carrusel (29 oct)'],
  ['fachada-noche-halloween.png', 'fachada-noche', { left: 0, top: 195, width: 980, height: 430 }, 1100, 'IG · publicación Halloween (31 oct)'],
  ['fachada-atardecer.png', 'fachada-atardecer', { left: 0, top: 120, width: 819, height: 980 }, 900, 'IG · reel (8 oct)'],
  ['fachada-letras-dia.png', 'fachada-dia', { left: 0, top: 260, width: 819, height: 1196 }, 820, 'IG · reel (17 oct)'],
  ['muro-logo-coctel.png', 'muro-logo', null, 820, 'IG · reel'],
  ['aguachile-cerca.png', 'aguachile-real', { left: 0, top: 150, width: 819, height: 1150 }, 820, 'IG · reel'],
  ['makizen-roll-palillos.png', 'makizen-roll-real', { left: 0, top: 150, width: 819, height: 1200 }, 820, 'IG · reel'],
  ['udon-reel.png', 'udon-real', { left: 290, top: 520, width: 529, height: 560 }, 560, 'IG · reel (8 oct)'],
];

const tam = {};
for (const [archivo, salida, recorte, ancho, origen] of fotos) {
  let img = sharp(join(src, archivo));
  if (recorte) img = img.extract(recorte);
  const out = await img.resize({ width: ancho, withoutEnlargement: true }).webp({ quality: 74, effort: 6 }).toFile(`public/fotos/${salida}.webp`);
  tam[salida] = { w: out.width, h: out.height, origen };
}
writeFileSync('src/data/fotos-redes.json', JSON.stringify(tam, null, 2) + '\n');
console.log(Object.entries(tam).map(([k, v]) => `${k} ${v.w}x${v.h}`).join('\n'));
