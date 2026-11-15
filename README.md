# MAKIZEN · Menú digital

Menú web (PWA) de **MAKIZEN Sushi & Mariscos**, Puerto Peñasco, Sonora: bilingüe, para teléfono, tablet y computadora, con **Mi lista** y pedido por WhatsApp (en mesa, para llevar o a domicilio). Propuesta para el restaurante.

- Propuesta (requerimientos, lógica, plan): [`docs/propuesta-menu-digital.html`](docs/propuesta-menu-digital.html)
- Marca, paleta, tipografías, fotos y menú reales: [`docs/marca-actual.md`](docs/marca-actual.md)
- Bases técnicas: [`docs/bases-menu-digital.html`](docs/bases-menu-digital.html)
- Datos del menú (validados con zod al compilar): `src/data/menu.json` y `src/data/schema.ts`

## Uso

Requiere Node 24 LTS (Astro 7 pide >= 22.23.4).

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # pruebas de la lógica (vitest)
npm run check      # tipos y validación de Astro
npm run build      # sitio estático en dist/ + service worker (scripts/sw.mjs)
npm run verificar  # revisa dist/ (páginas, noindex, JSON-LD, precache)
npx astro preview --port 4329 & npm run e2e   # pruebas en navegador a 390, 820 y 1440 px
```

| Comando | Para qué |
|---|---|
| `npm run og` | Regenera `public/og/makizen.jpg` (vista previa al compartir). |
| `SITE_URL=https://… npm run qr -- 12` | QR por mesa en `qr/` (SVG por mesa y `hoja.html` para imprimir). |

### Cambiar precios, agotados o platillos

Todo está en `src/data/menu.json`. `agotado: true` deja el platillo visible en gris y no se puede agregar a la lista. `opciones` define sabores a elegir (sin cambio de precio). Si un dato está mal, `npm run build` falla y el sitio publicado sigue como estaba.

### Despliegue en Cloudflare

El sitio es 100 % estático y se publica con **Cloudflare Workers Static Assets** conectado a GitHub (cada push publica):

1. Cloudflare → **Workers & Pages** → **Create** → **Import a repository** → `LuisMario698/vibeMAKISEN`.
2. Nombre del proyecto: `makizen-menu` (igual que `wrangler.jsonc`).
3. Build command: `npm run build` · Deploy command: `npx wrangler deploy`.
4. Rama de producción: `claude/affectionate-hawking-ps3z4n`.
5. Variables de build: `SITE_URL` = la URL que asigne Cloudflare (por ejemplo `https://makizen-menu.<cuenta>.workers.dev`). `PUBLIC_INDEXAR=true` solo cuando el restaurante apruebe que se indexe.

`public/_headers` define la caché (`immutable` para `/_astro/*`, `no-cache` para `sw.js`) y `noindex` en `*.workers.dev`. La versión anterior sigue en Vercel (`vercel.json`) hasta validar Cloudflare.

### PWA y sin conexión

`scripts/sw.mjs` genera `dist/sw.js` con workbox-build después del build: precache solo del shell (JS, CSS, fuentes, logo, íconos y `/offline/`), navegación red-primero con espera de 3 s (ignora `?src=`), fotos caché-primero. Al activarse guarda `/` y `/en/`, así el menú abre sin señal desde la primera visita.

### Pedido por WhatsApp

La lógica es pura y probada en `src/lib/pedido.ts` (`tests/pedido.test.ts`); la interfaz en `src/scripts/lista.ts` y `src/components/Lista.astro`. La mesa llega por el QR (`?src=qr-mesa-N`), se guarda en la sesión y se quita de la URL. El mensaje va en el idioma del cliente con los nombres de platillo en español, subtotal en MXN con IVA y "Precio final lo confirma el restaurante".

Recursos (se generan una vez y se versionan):

- `node scripts/vectorizar-logo.mjs <img-cartilla>`: logo en SVG transparente (vertical, horizontal e isotipo) e íconos de la app.
- `npm run assets -- <img-cartilla>`: fotos recortadas de platillos (cutouts) de la cartilla.
- `node scripts/prepare-fotos-redes.mjs <originales>`: fotos reales de Instagram en resolución original, recortadas y en WebP de 640 y 1080 px.

## Diseño

Sobrio y editorial, fiel al lugar: negro profundo, superficies grafito, blanco hueso, el **dorado de la marca solo como acento** y fotografía real como protagonista. Poppins y Montserrat, las mismas de su cartilla.

1. **Portada:** titular grande con el estado del local en vivo. Debajo, la fachada del local (foto del negocio en Google Maps) que **se abre a todo lo ancho al hacer scroll**, y datos rápidos (hoy, dónde, a domicilio).
2. **Favoritos de la casa:** mosaico con fotos reales.
   Los productos sin foto pública (52 de 85) usan una ilustración dorada de su tipo; ver `docs/marca-actual.md`.
3. **La carta:** por categoría, una cabecera limpia con foto real opcional. Toda la comida va en rejilla de tarjetas; las bebidas sin foto, en lista compacta con miniatura.
4. **Visítanos:** fachada al atardecer, dirección, horario con el día de hoy resaltado y galería del lugar.
5. **Isla dinámica dorada** para navegar categorías y buscar.

## Interacción líquida

Dos piezas usan el mismo principio: manchas sólidas bajo un **filtro SVG "goo"** (`feGaussianBlur` + `feColorMatrix`). Cuando se acercan se funden y cuando se separan forman un cuello, como un líquido. El texto, las fotos y los botones van en otra capa sin filtro, nítidos y accesibles.

- **Isla dinámica:** píldora unida a la lupa por un puente líquido. Al cambiar de categoría salta una gota; se puede deslizar a los lados; al tocarla se derrama en un panel con todas las categorías y el buscador.
- **Seleccionar un producto:** se toca en cualquier parte de la tarjeta (foto, nombre o precio). La apertura tiene tres tiempos:
  1. La tarjeta **crece** y se levanta sobre un velo, con un resorte suave.
  2. Se vuelve **líquido y se derrama hacia abajo** como una columna, con gotas que caen por delante. Luego se abre a lo ancho hasta formar la hoja, mientras la foto vuela a su lugar.
  3. Aparece el **panel**: la barrita se estira, entra el botón de cerrar y el contenido escalonado.

  Al cerrar ocurre en reversa: la hoja se recoge en columna, sube, se funde con la tarjeta y esta vuelve a su tamaño. Arrastrar la barrita hacia arriba abre la hoja a pantalla completa; hacia abajo, la baja o la cierra.

## Animación: qué se usa y por qué

**0 KB de librerías.** Todo es nativo del navegador (Web Animations API, IntersectionObserver, CSS scroll-driven, filtros SVG).

| Momento | Técnica | Si el navegador no lo soporta |
|---|---|---|
| Titular que sube renglón por renglón; foto que entra | CSS `@keyframes` | Aparece sin animación |
| Foto de portada que se abre a todo lo ancho; parallax de las fotos | CSS scroll-driven (`view()`) | Foto fija con esquinas redondeadas |
| Mosaico y cabeceras que se abren como cortina | `clip-path` + IntersectionObserver | Aparecen sin animación |
| Tarjeta que crece, líquido que se derrama y panel | WAAPI + filtro SVG goo | Hoja que sube con CSS |
| Isla dinámica | Filtro SVG goo + transiciones con resorte | — |
| Cambio de idioma ES/EN | View Transitions (fundido) | Cambio instantáneo |

Con **"Reducir movimiento"** activado en el sistema se apagan el líquido, el parallax y las cortinas; todo aparece directo.
