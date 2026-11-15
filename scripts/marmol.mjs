// Genera los fondos de mármol a partir de la portada de la cartilla del restaurante
// (imagen de 2189×1460 dentro del PDF del menú; se extrae con `pdfimages -j -f 1 -l 1`).
// Uso: node scripts/marmol.mjs ruta/a/portada.jpg
// Salida: public/fondos/marmol.webp (horizontal) y marmol-v.webp (vertical, para teléfono).
// Las vetas más brillantes se comprimen (rodilla suave) para que el texto encima conserve
// contraste AA; el oscurecimiento final por zona se hace en CSS con capas encima.
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const origen = process.argv[2];
if (!origen) { console.error('Uso: node scripts/marmol.mjs portada.jpg'); process.exit(1); }
await mkdir('public/fondos', { recursive: true });

const RODILLA = 50; // a partir de aquí las vetas suben a la mitad de velocidad
const TOPE = 80;
const curva = (v) => Math.min(TOPE, v < RODILLA ? v : RODILLA + (v - RODILLA) * 0.5);
// Tinte cálido muy leve, como los neutros de la marca.
const tinte = [1, 0.985, 0.95];

async function generar(salida, ancho, girar) {
  let img = sharp(origen).removeAlpha();
  if (girar) img = img.rotate(90);
  const { data, info } = await img.resize({ width: ancho }).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 3) {
    const l = curva((data[i] + data[i + 1] + data[i + 2]) / 3);
    data[i] = Math.round(l * tinte[0]);
    data[i + 1] = Math.round(l * tinte[1]);
    data[i + 2] = Math.round(l * tinte[2]);
  }
  const r = await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .webp({ quality: 58, effort: 6, smartSubsample: true })
    .toFile(`public/fondos/${salida}`);
  console.log(salida, `${r.width}×${r.height}`, `${Math.round(r.size / 1024)} KB`);
}

await generar('marmol.webp', 1600, false);
await generar('marmol-v.webp', 1080, true);
