// Revisa la salida del build antes de publicar.
import { existsSync, readFileSync, statSync } from 'node:fs';

const fallas = [];
const debe = (cond, msg) => { if (!cond) fallas.push(msg); };
for (const f of ['index.html', 'en/index.html', 'offline/index.html', '404.html', 'sw.js', 'manifest.webmanifest', 'robots.txt', 'sitemap.xml', '_headers', 'og/makizen.jpg'])
  debe(existsSync(`dist/${f}`), `falta dist/${f}`);
const html = readFileSync('dist/index.html', 'utf8');
const en = readFileSync('dist/en/index.html', 'utf8');
const indexar = process.env.PUBLIC_INDEXAR === 'true';
debe(indexar || html.includes('noindex'), 'la página debe llevar noindex mientras sea demo');
debe(html.includes('application/ld+json'), 'falta el JSON-LD');
debe(en.includes('lang="en"'), '/en/ debe declarar lang="en"');
debe(!/<\/script>\s*<\/script>/.test(html), 'JSON embebido mal escapado');
const sw = readFileSync('dist/sw.js', 'utf8');
debe(sw.includes('offline/index.html'), 'el service worker debe precachear la página sin conexión');
debe(!sw.includes('url:"index.html"'), 'el HTML no debe ir en el precache (se quedaría pegado)');
const total = (re) => [...sw.matchAll(re)].map((m) => m[1]).filter((f) => existsSync(`dist/${f}`)).reduce((s, f) => s + statSync(`dist/${f}`).size, 0);
const shell = total(/url:"([^"]+)"/g);
debe(shell < 600 * 1024, `precache de ${Math.round(shell / 1024)} KB (máximo 600 KB)`);
if (fallas.length) { console.error('verificar-dist:\n- ' + fallas.join('\n- ')); process.exit(1); }
console.log(`verificar-dist: todo bien (precache ${Math.round(shell / 1024)} KB)`);
