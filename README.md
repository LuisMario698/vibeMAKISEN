# MAKIZEN · Menú digital (demo)

Demo navegable del menú web móvil (PWA) de **MAKIZEN Sushi & Mariscos**, Puerto Peñasco, Sonora. Propuesta para el restaurante.

- Marca, paleta, tipografías y menú reales: [`docs/marca-actual.md`](docs/marca-actual.md)
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

`npm run assets -- <carpeta>` vuelve a generar las fotos WebP y logos a partir de las imágenes extraídas del PDF de la cartilla.

## Animación: qué se usa y por qué

**0 KB de librerías.** Todo es nativo del navegador para no pasar el presupuesto de primera carga (< 80 KB críticos; hoy ≈ 70 KB comprimidos con fuentes):

| Momento | Técnica | Si el navegador no lo soporta |
|---|---|---|
| Entrada: el logo se "pinta" como la pincelada de la luna, mármol que deriva, mesa de platillos que sube | CSS `@keyframes` + `@property` (máscara cónica) | Se ve el logo completo |
| Parallax de la portada y fotos que flotan/giran al hacer scroll | CSS scroll-driven animations (`animation-timeline: scroll()/view()`) | Sin parallax |
| Tarjetas que aparecen al hacer scroll, filetes dorados que se trazan, chiles que se encienden | `IntersectionObserver` + transiciones CSS escalonadas | — |
| Cambio de categoría: indicador que se desliza con resorte y destello dorado en el título | Transiciones CSS + `scrollIntoView` | — |
| Detalle del platillo: la foto viaja de la tarjeta a la hoja | View Transitions API | Hoja que sube con CSS |
| Cambio de idioma ES/EN | View Transitions (fundido) | Cambio instantáneo |
| Cerrar la hoja deslizando hacia abajo | Pointer events + Web Animations API | Botón cerrar / Esc |

Solo se animan `transform`, `opacity`, `filter` y máscaras (capa de composición). Con **"Reducir movimiento"** del sistema se apagan desplazamientos, parallax y barridos.

GSAP o Motion se descartaron: añadirían 20–60 KB para efectos que el navegador ya hace nativamente.
