// Códigos QR por mesa para imprimir: qr/mesa-N.svg y qr/hoja.html (lista para imprimir).
// Uso: SITE_URL=https://menu.ejemplo.mx npm run qr -- 12   (12 = número de mesas)
import QRCode from 'qrcode';
import { mkdirSync, writeFileSync } from 'node:fs';

const sitio = (process.env.SITE_URL || 'http://localhost:4321').replace(/\/$/, '');
const mesas = Math.max(1, Math.min(99, Number(process.argv[2]) || 12));
mkdirSync('qr', { recursive: true });
const tarjetas = [];
for (let n = 1; n <= mesas; n++) {
  const url = `${sitio}/?src=qr-mesa-${n}`;
  const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#050505', light: '#ffffff' } });
  writeFileSync(`qr/mesa-${n}.svg`, svg);
  tarjetas.push(`<figure><div class="qr">${svg}</div><figcaption><b>Mesa ${n}</b><span>Escanea para ver el menú · Scan for menu</span><small>${sitio.replace(/^https?:\/\//, '')}</small></figcaption></figure>`);
}
writeFileSync('qr/hoja.html', `<!doctype html><meta charset="utf-8"><title>QR por mesa · MAKIZEN</title>
<style>body{font-family:Poppins,system-ui,sans-serif;margin:0;padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
figure{margin:0;border:1px solid #ccc;border-radius:16px;padding:16px;text-align:center;break-inside:avoid}
.qr svg{width:100%;height:auto}figcaption{display:grid;gap:4px}b{font-size:20px}small{color:#666}
@media print{body{padding:0}figure{border-color:#999}}</style>${tarjetas.join('')}`);
console.log(`qr: ${mesas} códigos en qr/ apuntando a ${sitio}`);
