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

- `npm run assets -- <carpeta>`: fotos recortadas de platillos y logos, extraídos del PDF de la cartilla.
- `node scripts/prepare-fotos-redes.mjs <carpeta>`: fotos reales recortadas de publicaciones y reels de @makizen.puertopenasco (sin los textos de las plantillas ni los subtítulos).

## Navegación: isla dinámica de "oro líquido"

En lugar de una barra de pestañas, las categorías viven en una **isla dorada sólida** abajo de la pantalla, al alcance del pulgar:

- **Píldora** con anillo de progreso, número y nombre de la categoría actual. Va unida a un botón de búsqueda por un **puente líquido**.
- Al cambiar de categoría, el nombre **rueda**, la píldora se estira o encoge con resorte y una **gota salta** y se vuelve a fundir.
- **Deslizar** la píldora a los lados (o usar las flechas del teclado) pasa a la categoría anterior o siguiente.
- Al tocarla se **derrama** en un panel con todas las categorías (con miniatura y número de platillos). Unas gotas salpican primero y el panel las absorbe. Al cerrar, escurre de vuelta a la píldora.
- La lupa abre el mismo panel como **buscador**: busca en español o inglés, ignora los acentos y abre el detalle directo.

Técnica: las manchas doradas son `div` normales bajo un **filtro SVG "goo"** (`feGaussianBlur` + `feColorMatrix`): cuando se acercan se funden y cuando se separan forman un cuello, como un líquido. El texto y los botones van en otra capa **sin filtro**, así que siguen nítidos y accesibles (roles, `aria-expanded`, foco, Esc).

## Animación: qué se usa y por qué

**0 KB de librerías.** Todo es nativo del navegador. Primera carga: HTML + CSS + JS ≈ 47 KB comprimidos, y fuentes ≈ 42 KB (WOFF2, no bloquean).

| Momento | Técnica | Si el navegador no lo soporta |
|---|---|---|
| Telón de entrada: el isotipo se pinta como la pincelada de la luna y la cortina sube con borde curvo (solo la primera visita de la sesión) | CSS `@property` + `clip-path` | No aparece |
| Portada estilo historias con fotos reales, Ken Burns, barras de progreso y tocar a los lados | CSS + `IntersectionObserver` (pausa fuera de pantalla) | Primera foto fija |
| Lema que cae letra por letra; logo que se pinta | CSS escalonado | Texto fijo |
| Parallax de portada, portadas de categoría y foto de la fachada | CSS scroll-driven (`scroll()` / `view()`) | Sin parallax |
| Carrusel "Imprescindibles" con cartas que crecen al centrarse | `scroll-snap` + `view(inline)` | Carrusel normal |
| Portadas de categoría que se abren como cortina; títulos que suben palabra por palabra | `clip-path` + `IntersectionObserver` | Aparecen sin animación |
| Tarjetas: barrido de luz, inclinación 3D y brillo que sigue al cursor | CSS + pointer events (solo con cursor) | Tarjeta plana |
| Isla dinámica líquida | Filtro SVG goo + transiciones con resorte | — |
| Detalle del platillo: la foto viaja de la tarjeta a la hoja | View Transitions API | Hoja que sube con CSS |
| Cambio de idioma ES/EN | View Transitions (fundido) | Cambio instantáneo |

Solo se animan `transform`, `opacity`, `filter`, `clip-path` y máscaras, más la geometría de las manchas de la isla (elementos pequeños y aislados). Con **"Reducir movimiento"** del sistema se apagan el telón, el parallax, los barridos, las gotas y la inclinación.

GSAP o Motion se descartaron: añadirían 20–60 KB para efectos que el navegador ya hace nativamente.
