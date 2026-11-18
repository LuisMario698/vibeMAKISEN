// Genera dist/sw.js DESPUÉS del build de Astro, cuando el HTML ya existe.
// - Precache solo del "shell": JS/CSS con hash, fuentes, logo, íconos y la página sin conexión.
// - Navegación: red primero (espera 3 s) y, sin señal, la última copia guardada; si no hay, /offline/.
//   El parámetro ?src=qr-mesa-N no crea copias distintas.
// - Fotos: caché primero con caducidad (una foto nueva debe llevar nombre nuevo).
// - Al activarse guarda / y /en/ para que el menú abra sin conexión desde la primera visita.
import { generateSW } from 'workbox-build';
import { readFileSync, writeFileSync } from 'node:fs';

const VERSION = 'v4';
const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  // Leaflet solo se carga al elegir "A domicilio": no va en el precache (lo guarda la regla de /_astro/).
  // La guía del comensal llega tras la intro (import dinámico) y es opcional: tampoco va en el precache.
  globIgnores: ['_astro/leaflet*', '_astro/guia*'],
  globPatterns: ['_astro/**/*.{js,css,woff2}', 'brand/{logo-horizontal,logo-vertical,isotipo}.svg', 'brand/icon-*.png', 'offline/index.html', 'manifest.webmanifest'],
  swDest: 'dist/sw.js',
  cacheId: 'makizen',
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  inlineWorkboxRuntime: true,
  sourcemap: false,
  mode: 'production',
  navigateFallback: null,
  ignoreURLParametersMatching: [/^src$/, /^utm_/, /^fbclid$/],
  runtimeCaching: [
    {
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: `makizen-paginas-${VERSION}`,
        networkTimeoutSeconds: 3,
        precacheFallback: { fallbackURL: '/offline/index.html' },
        plugins: [
          {
            // Una sola copia por página aunque llegue con ?src=qr-mesa-N u otros parámetros.
            cacheKeyWillBeUsed: async ({ request }) => {
              const u = new URL(request.url);
              u.search = '';
              return u.href;
            },
            // Solo se guardan respuestas buenas y finales (nunca una redirección).
            cacheWillUpdate: async ({ response }) => (response && response.ok && !response.redirected ? response : null),
          },
        ],
      },
    },
    {
      urlPattern: ({ url }) => /^\/(fotos|menu|brand|og|fondos)\//.test(url.pathname),
      handler: 'CacheFirst',
      // Incluye las variantes de public/menu/v/ (scripts/miniaturas.mjs): más entradas.
      options: { cacheName: `makizen-fotos-${VERSION}`, expiration: { maxEntries: 180, maxAgeSeconds: 30 * 24 * 3600 }, cacheableResponse: { statuses: [0, 200] } },
    },
    {
      urlPattern: ({ url }) => url.pathname.startsWith('/_astro/'),
      handler: 'CacheFirst',
      options: { cacheName: `makizen-astro-${VERSION}`, expiration: { maxEntries: 60 } },
    },
  ],
});

// Al activarse: guarda las dos páginas del menú y borra cachés de versiones o SW anteriores.
const extra = `
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const vigentes = new Set(['makizen-paginas-${VERSION}', 'makizen-fotos-${VERSION}', 'makizen-astro-${VERSION}']);
    for (const k of await caches.keys()) {
      if (k.startsWith('makizen-precache') || k.startsWith('makizen-runtime')) continue;
      if (!vigentes.has(k)) await caches.delete(k);
    }
    const c = await caches.open('makizen-paginas-${VERSION}');
    await Promise.all(['/', '/en/'].map(async (p) => {
      try { const r = await fetch(p, { cache: 'no-cache' }); if (r.ok) await c.put(new URL(p, self.location.origin).href, r); } catch {}
    }));
  })());
});
`;
writeFileSync('dist/sw.js', readFileSync('dist/sw.js', 'utf8') + extra);
warnings.forEach((w) => console.warn('sw:', w));
console.log(`sw: ${count} archivos en precache (${(size / 1024).toFixed(0)} KB)`);
