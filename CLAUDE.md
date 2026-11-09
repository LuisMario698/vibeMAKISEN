# MAKIZEN · Menú digital (demo / propuesta)

Responde siempre en español.

## Objetivo
Construir una **demo navegable** del menú digital (web móvil / PWA) de **MAKIZEN Sushi & Mariscos** (Puerto Peñasco, Sonora) para presentarla al restaurante como propuesta.
- Debe sentirse **moderna y llamativa**, con **animación en todo el menú** (entrada de la página, cambio de categoría, tarjetas al hacer scroll, apertura del detalle del platillo, micro-interacciones), fiel a la estética real del lugar.
- Mobile-first: casi todos llegan escaneando un QR desde el teléfono.
- Bilingüe ES (principal) / EN.

## Paso 1 (obligatorio antes de diseñar): investigar la marca real
Usa Chrome (Claude in Chrome, con la sesión del usuario iniciada) para revisar:
- Instagram: https://www.instagram.com/makizen.puertopenasco/ — foto de perfil/logo, las ~17 publicaciones, historias destacadas, captions, hashtags.
- Facebook: página "Makizen Sushi y Marisco" — portada, fotos, menú/cartilla, reseñas, dirección.
- La "cartilla" (menú actual en internet) que el negocio ya tiene: platillos, categorías, tamaños y precios.

Entregable del paso 1, en `docs/marca-actual.md`:
- Logo (descripción + guardar archivo en `public/brand/` si se puede descargar).
- Paleta real en HEX (extraída de logo y posts) y tipografías identificadas.
- Estética / temática / estilo del lugar (local, ambiente, fotografía, tono de voz de sus posts).
- Público objetivo según sus publicaciones y comentarios.
- Menú real (categorías, platillos, precios) para cargar en `src/data/menu.json`.
No inventar identidad: todo lo visual sale de lo que tienen. Si algo no existe, decirlo.

## Lo que ya sabemos (verificado el 8 nov 2026)
- Nombre en IG: "MAKIZEN SUSHI & MARISCOS", @makizen.puertopenasco, 680 seguidores, 17 posts.
- Bio: "Sushi & Mariscos estilo Sinaloa · Puerto Peñasco, Sonora · Lun/Mié/Jue 1 a 9 pm | Vie-Dom 1 a 10 pm · (638) 156-0660". Cierra martes.
- Facebook: "Makizen Sushi y Marisco". Uber Eats: "Makizen Sushi Y Mariscos" (Blvd. Freemont y Josefa Ortiz de Domínguez #330, sin confirmar).
- Abrió ~10 oct 2026, "cocina estilo Culiacán". Reseñas destacan: camarón roca, aguachiles, tostadas de atún, rollos sinaloenses.
- Público: locales y turismo nacional (Sonora/BC) + turistas de Arizona y snowbirds (inglés).
- Ojo: existe otro "Maki-Zen" en Puebla; no confundir.
- Documento completo de bases: `docs/bases-menu-digital.html`.

## Decisiones técnicas (ver docs/bases-menu-digital.html)
- Astro 7.4.x (Node 24 LTS; Astro exige >= 22.23.4), Tailwind CSS 4.3.x con tokens en `@theme`, TypeScript estricto, zod para el esquema de `src/data/menu.json`.
- PWA con @vite-pwa/astro 2.x (Workbox 7.4). Hosting previsto: Cloudflare Workers Static Assets.
- Para la demo: datos en `src/data/menu.json` (sin Supabase todavía).
- Animación: elegir lo mejor para el proyecto (p. ej. View Transitions de Astro, CSS scroll-driven animations, Motion o GSAP), justificando peso y rendimiento. Siempre respetar `prefers-reduced-motion` y no romper el scroll ni la legibilidad.

## Reglas
- Precios en MXN con IVA incluido y textos en español como principales; USD solo como "≈ referencia" (Profeco / LFPC art. 7 Bis).
- Etiquetas de platillo: picante 0–3 (icono + texto, nunca solo color), crudo/curtido, empanizado/natural/horneado, nuevo, favorito, agotado (visible en gris).
- Accesibilidad AA, objetivos táctiles >= 44 px, texto base >= 16 px, zoom permitido.
- Rama de trabajo: `claude/affectionate-hawking-ps3z4n`. Commits en español, claros.
