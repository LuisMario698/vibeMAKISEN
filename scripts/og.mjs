// Imagen para compartir el enlace (Open Graph, 1200×630): foto real del local,
// degradado oscuro y el logo horizontal. Sin texto: sharp depende de las fuentes del sistema.
// Uso: npm run og  →  public/og/makizen.jpg (se versiona).
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';

const W = 1200, H = 630;
mkdirSync('public/og', { recursive: true });
const fondo = await sharp('public/fotos/mesa-madera-1600.webp').resize(W, H, { fit: 'cover', position: 'centre' }).modulate({ brightness: 0.82 }).toBuffer();
const degradado = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#050505" stop-opacity="0.96"/><stop offset="0.45" stop-color="#050505" stop-opacity="0.82"/><stop offset="0.75" stop-color="#050505" stop-opacity="0.35"/><stop offset="1" stop-color="#050505" stop-opacity="0.1"/></linearGradient>
  </defs><rect width="100%" height="100%" fill="url(#g)"/><rect x="0" y="${H - 6}" width="${W}" height="6" fill="#ae8b3d"/></svg>`);
const logo = await sharp(readFileSync('public/brand/logo-horizontal.svg'), { density: 300 }).resize({ width: 560 }).png().toBuffer();
const { height: lh = 220 } = await sharp(logo).metadata();
await sharp(fondo)
  .composite([{ input: degradado }, { input: logo, left: 72, top: Math.round((H - lh) / 2) }])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile('public/og/makizen.jpg');
console.log('og: public/og/makizen.jpg');
