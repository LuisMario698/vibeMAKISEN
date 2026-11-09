// Después de `astro build`: agrega index.html al precache del service worker.
// @vite-pwa/astro genera sw.js antes de que Astro escriba el HTML, así que la página
// no quedaba guardada y el menú no abría sin conexión. Con la entrada (y su hash como
// revisión) Workbox sirve "/" desde caché gracias a `directoryIndex: index.html`.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const sw = readFileSync('dist/sw.js', 'utf8');
if (sw.includes('url:`index.html`')) {
  console.log('precache-html: index.html ya estaba en el precache');
} else {
  const html = readFileSync('dist/index.html');
  const revision = createHash('md5').update(html).digest('hex');
  const i = sw.indexOf('[{url:');
  if (i < 0) throw new Error('precache-html: no encontré la lista de precache en dist/sw.js');
  writeFileSync('dist/sw.js', `${sw.slice(0, i + 1)}{url:\`index.html\`,revision:\`${revision}\`},${sw.slice(i + 1)}`);
  console.log(`precache-html: index.html agregado (revisión ${revision.slice(0, 8)})`);
}
