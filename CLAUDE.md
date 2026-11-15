# MAKIZEN · Menú digital (demo / propuesta)

Responde siempre en español.

## Objetivo
Construir una **demo navegable** del menú digital (web móvil / PWA) de **MAKIZEN Sushi & Mariscos** (Puerto Peñasco, Sonora) para presentarla al restaurante como propuesta.
- Debe sentirse **moderna y llamativa**, con **animación en todo el menú** (entrada de la página, cambio de categoría, tarjetas al hacer scroll, apertura del detalle del platillo, micro-interacciones), fiel a la estética real del lugar.
- Mobile-first: casi todos llegan escaneando un QR desde el teléfono.
- Bilingüe ES (principal) / EN.

## Paso 1 (obligatorio antes de diseñar): investigar la marca real
Usa Chrome (Claude in Chrome, con la sesión del usuario iniciada en Instagram y Facebook). Trabaja en una pestaña nueva y solo lee: no des "me gusta", no sigas cuentas, no comentes ni envíes mensajes.

1. Instagram https://www.instagram.com/makizen.puertopenasco/
   - Foto de perfil: ábrela en grande y guarda una captura como `public/brand/logo-perfil.png`.
   - Las ~17 publicaciones: abre cada una; guarda capturas de 3–5 representativas en `public/brand/posts/` (platillos, local, promos con texto).
   - Captions y hashtags: cópialos tal cual (tono de voz, idioma, emojis, promos, precios mencionados).
   - Historias destacadas: nombres y contenido (menú, ubicación, promos).
   - Comentarios: idioma (¿hay inglés?), qué elogian y qué critican.
2. Facebook: busca la página "Makizen Sushi y Marisco" (Puerto Peñasco; no confundir con "Maki-Zen" de Puebla).
   - Portada y foto de perfil (capturas en `public/brand/`), sección Información (dirección exacta, teléfono, WhatsApp), reseñas, fotos del local y del menú.
3. La cartilla (menú actual en internet): busca el enlace en la bio de Instagram, los destacados o la página de Facebook. Transcribe categorías, platillos, tamaños y precios.
4. Paleta: corre `python3 scripts/extraer_paleta.py public/brand/logo-perfil.png public/brand/posts/*` (requiere `pip3 install pillow`) y asigna roles (fondo, primario, acento, texto) con lo que salga.

Entregable: llena `docs/marca-actual.md` (ya tiene la plantilla) y `src/data/menu.json`. Después actualiza la sección de identidad visual de `docs/estudio-de-esencia.html` con los datos reales.
No inventar identidad: todo lo visual sale de lo que tienen. Si algo no existe, decirlo.

## Pedidos: por WhatsApp (decidido; propuesta en docs/propuesta-menu-digital.html)
- Las comandas se mandan por WhatsApp a `negocio.whatsapp`. Sin pago en línea ni pedidos guardados en servidor.
- "Mi lista": platillo, opción (sabor), cantidad 1–20, nota ≤ 80; máx. 30 líneas. Estado en localStorage (`makizen-lista`, versión `v:1`, caduca a las 12 h) siempre en try/catch; se sanea contra el menú vigente (agotados fuera del total, precios actualizados, platillos inexistentes fuera).
- Tres modalidades: **en mesa** (mesa 1–99 desde `?src=qr-mesa-N`, guardada en sessionStorage y quitada de la URL), **para llevar** (nombre + hora) y **a domicilio** (nombre + dirección + referencias; envío lo confirma el restaurante).
- Mensaje en ES o EN según el idioma, con el nombre del platillo siempre en español, subtotal en MXN con IVA y "Precio final lo confirma el restaurante". La lógica pura vive en `src/lib/pedido.ts` con pruebas.

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
- PWA: service worker generado después del build (`scripts/sw.mjs`, workbox-build); precache solo del shell, navegación red-primero. Hosting: Cloudflare Workers Static Assets conectado a GitHub (`wrangler.jsonc`, `public/_headers`).
- Para la demo: datos en `src/data/menu.json` (sin Supabase todavía).
- Animación: elegir lo mejor para el proyecto (p. ej. View Transitions de Astro, CSS scroll-driven animations, Motion o GSAP), justificando peso y rendimiento. Siempre respetar `prefers-reduced-motion` y no romper el scroll ni la legibilidad.

## Reglas
- Precios en MXN con IVA incluido y textos en español como principales; USD como "≈ referencia" visible en ambos idiomas, con tipo de cambio y fecha (Profeco / LFPC art. 7 Bis).
- Lógica pura (horario, precios, pedido, mesa, SEO) en `src/lib/` con pruebas vitest. Nunca `innerHTML` con texto del cliente; escapar datos interpolados.
- Etiquetas de platillo: picante 0–3 (icono + texto, nunca solo color), crudo/curtido, empanizado/natural/horneado, nuevo, favorito, agotado (visible en gris).
- Accesibilidad AA, objetivos táctiles >= 44 px, texto base >= 16 px, zoom permitido.
- Rama de trabajo: `claude/affectionate-hawking-ps3z4n`. Commits en español, claros.
