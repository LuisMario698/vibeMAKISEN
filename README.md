# MAKIZEN · Menú digital (demo)

Demo navegable del menú web móvil (PWA) de **MAKIZEN Sushi & Mariscos**, Puerto Peñasco, Sonora. Propuesta para el restaurante.

- Marca, paleta, tipografías, fotos y menú reales: [`docs/marca-actual.md`](docs/marca-actual.md)
- Bases del proyecto: [`docs/bases-menu-digital.html`](docs/bases-menu-digital.html)
- Datos del menú (validados con zod al compilar): `src/data/menu.json` y `src/data/schema.ts`

## Uso

Requiere Node 24 LTS (Astro 7 pide >= 22.23.4).

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # sitio estático en dist/ con service worker
npm run check    # tipos y validación de Astro
```

Recursos (se generan una vez y se versionan):

- `node scripts/vectorizar-logo.mjs <img-cartilla>`: logo en SVG transparente (vertical, horizontal e isotipo) e íconos de la app.
- `npm run assets -- <img-cartilla>`: fotos recortadas de platillos (cutouts) de la cartilla.
- `node scripts/prepare-fotos-redes.mjs <originales>`: fotos reales de Instagram en resolución original, recortadas y en WebP de 640 y 1080 px.

## Diseño

Sobrio y editorial, fiel al lugar: negro profundo, superficies grafito, blanco hueso, el **dorado de la marca solo como acento** y fotografía real como protagonista. Poppins y Montserrat, las mismas de su cartilla.

1. **Portada:** titular grande con el estado del local en vivo. Debajo, una sola foto real que **se abre a todo lo ancho al hacer scroll**, y datos rápidos (hoy, dónde, a domicilio).
2. **Favoritos de la casa:** mosaico con fotos reales.
3. **La carta:** por categoría, una cabecera limpia con foto real opcional. Los platillos con foto van en rejilla de "producto" y el resto como lista de carta impresa.
4. **Visítanos:** fachada al atardecer, dirección, horario con el día de hoy resaltado y galería del lugar.
5. **Isla dinámica dorada** para navegar categorías y buscar.

## Interacción líquida

Dos piezas usan el mismo principio: manchas sólidas bajo un **filtro SVG "goo"** (`feGaussianBlur` + `feColorMatrix`). Cuando se acercan se funden y cuando se separan forman un cuello, como un líquido. El texto, las fotos y los botones van en otra capa sin filtro, nítidos y accesibles.

- **Isla dinámica:** píldora unida a la lupa por un puente líquido. Al cambiar de categoría salta una gota; se puede deslizar a los lados; al tocarla se derrama en un panel con todas las categorías y el buscador.
- **Seleccionar un producto (des-merge):** la tarjeta se estira, suelta una gota que cae con un cuello líquido y, desde la base de la pantalla, el líquido se derrama hacia arriba hasta formar la hoja de detalle. La foto del platillo vuela a su lugar. Al cerrar, la hoja escurre a una gota que sube y se funde otra vez con la tarjeta.

## Animación: qué se usa y por qué

**0 KB de librerías.** Todo es nativo del navegador (Web Animations API, IntersectionObserver, CSS scroll-driven, filtros SVG).

| Momento | Técnica | Si el navegador no lo soporta |
|---|---|---|
| Titular que sube renglón por renglón; foto que entra | CSS `@keyframes` | Aparece sin animación |
| Foto de portada que se abre a todo lo ancho; parallax de las fotos | CSS scroll-driven (`view()`) | Foto fija con esquinas redondeadas |
| Mosaico y cabeceras que se abren como cortina | `clip-path` + IntersectionObserver | Aparecen sin animación |
| Des-merge del producto y fusión al cerrar | WAAPI + filtro SVG goo | Hoja que sube con CSS |
| Isla dinámica | Filtro SVG goo + transiciones con resorte | — |
| Cambio de idioma ES/EN | View Transitions (fundido) | Cambio instantáneo |

Con **"Reducir movimiento"** activado en el sistema se apagan el líquido, el parallax y las cortinas; todo aparece directo.
