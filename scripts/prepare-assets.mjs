// Convierte las imágenes extraídas de la cartilla (PDF de Canva del negocio)
// a WebP ligeros para la demo. Uso: node scripts/prepare-assets.mjs <carpeta-origen>
import sharp from 'sharp';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) throw new Error('Falta la carpeta con las imágenes extraídas');

const platillos = {
  'img528_669x377.png': 'triangulos-marlin',
  'img529_377x669.png': 'sashimi-mixto',
  'img520_432x768.png': 'tostada-atun',
  'img554_537x470.png': 'aguachile-mixto',
  'img543_669x377.png': 'bomba-especial',
  'img544_724x543.png': 'tuna-roca-roll',
  'img562_580x435.png': 'guamuchilito',
  'img561_561x308.png': 'culichi-roll',
  'img560_502x502.png': 'serrano-roll',
  'img570_669x377.png': 'futomaki-roll',
  'img568_600x435.png': 'makizen-roll',
  'img569_508x497.png': 'teriyaki-crispy',
  'img576_435x580.png': 'charola-premium',
  'img577_435x326.png': 'dedos-queso',
  'img578_377x669.png': 'helado-tempura',
  'img584_563x680.png': 'mixologia-1',
  'img585_527x395.png': 'mixologia-2',
  'img591_377x377.png': 'sayuri',
  'img592_377x377.png': 'hanagoi',
  'img595_428x331.png': 'jun-ho',
  'img593_428x331.png': 'ramune',
  'img594_377x377.png': 'sapporo',
  'img597_502x502.png': 'refrescos',
};

for (const [file, name] of Object.entries(platillos)) {
  await sharp(join(src, file)).trim({ threshold: 1 }).resize({ width: 560, height: 560, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, alphaQuality: 85, effort: 6 }).toFile(`public/menu/${name}.webp`);
}
// Logos e íconos: ver scripts/vectorizar-logo.mjs (SVG vectorial a partir de la cartilla).
console.log('Listo');

// Tamaños intrínsecos para width/height (evita saltos de layout).
import { readdirSync, writeFileSync } from 'node:fs';
const sizes = {};
for (const f of readdirSync('public/menu').filter((f) => f.endsWith('.webp'))) {
  const m = await sharp(`public/menu/${f}`).metadata();
  sizes[f.replace('.webp', '')] = [m.width, m.height];
}
writeFileSync('src/data/fotos.json', JSON.stringify(sizes, null, 2) + '\n');
