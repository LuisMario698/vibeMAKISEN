# MAKIZEN · Marca actual (paso 1)

Investigación hecha el **8 nov 2026** con la sesión iniciada en Chrome. Todo lo de aquí sale de lo que el negocio ya publica: su Instagram, su página de Facebook y la **cartilla en PDF** que enlazan desde la historia destacada "Menú 🍣" de Instagram.

Fuentes:

| Fuente | Qué es | Estado |
|---|---|---|
| Instagram [@makizen.puertopenasco](https://www.instagram.com/makizen.puertopenasco/) | Perfil verificado ✔︎, 17 publicaciones, **690 seguidores** (subió de 680), 14 seguidos. Categoría: Restaurante. | Revisado |
| Historias destacadas | "Domicilio 📍", "Menú 🍣", "Nosotros". Portadas doradas sobre negro. | Revisado |
| Cartilla (PDF) | `MENÚ-Makizen Sushi & Mariscos.pdf` en Google Drive (público), 10 páginas, hecho en **Canva**. Enlace: `drive.google.com/file/d/1_5mthhjB9_OXKfR5Lt0BITQoIqJKRpFQ` | Revisado y extraído |
| Facebook "Makizen Sushi & Mariscos" | `facebook.com/profile.php?id=61595144090878`. 98 seguidores, "Aún sin calificación (0 opiniones)". Misma bio que Instagram. | Revisado |

> Ojo con el nombre: en Facebook ahora se llama **"Makizen Sushi & Mariscos"** (no "Sushi y Marisco"). En la cartilla y en el logo: **MAKIZEN · SUSHI & MARISCOS**. Uber Eats sigue con "Makizen Sushi Y Mariscos". La forma oficial a usar en el menú digital es la del logo: **MAKIZEN Sushi & Mariscos**.

---

## 1. Logo

**Descripción.** Un **pez betta** blanco de cola larga y ondulada, nadando hacia la izquierda, dentro de una **luna creciente** trazada con pincelada (estilo *ensō* japonés, el trazo se abre a la derecha). Arriba a la derecha, un **punto dorado** (luna llena / sol). Siempre sobre negro.

Versiones que usan:

1. **Isotipo redondo**: pez + luna en blanco sobre círculo negro (foto de perfil de Instagram y Facebook).
2. **Horizontal**: isotipo a la izquierda, línea vertical dorada, wordmark **MAKIZEN** (serif romana de alto contraste, M y Z grandes) y debajo **— SUSHI & MARISCOS —** en dorado con filetes, más "Puerto Peñasco, Sonora" en dorado (encabezado de cada página de la cartilla).
3. **Vertical**: isotipo arriba, MAKIZEN y SUSHI & MARISCOS debajo (portada de la cartilla).
4. **Variante dorada**: todo el logo en dorado degradado sobre negro (publicación de "próximamente" y una del grid).
5. En la fachada: letras corpóreas oscuras sobre listones de madera; en el interior, el isotipo **retroiluminado** en un muro.

Archivos en `public/brand/`. **Vectorizados por nosotros** (`scripts/vectorizar-logo.mjs`) a partir de los PNG transparentes de 1000 × 1000 de la cartilla. Se trazaron con potrace por separado la capa blanca y la dorada (`#AE8B3D`), sin redibujar ni cambiar el diseño:

| Archivo | Contenido |
|---|---|
| `logo-vertical.svg` | Isotipo + MAKIZEN + — SUSHI & MARISCOS — (transparente) |
| `logo-horizontal.svg` | Isotipo │ MAKIZEN / SUSHI & MARISCOS (transparente) |
| `isotipo.svg` | Solo el pez y la luna con el punto dorado (transparente) |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | Íconos de la app generados desde `isotipo.svg` sobre negro |

No existe un logo vectorial oficial (SVG/AI) publicado. El nuestro es una vectorización fiel para la demo. Para producción conviene pedir el original a quien les hizo el Canva.

## 2. Paleta real

Medida en píxeles de la cartilla y del logo (no estimada a ojo):

| Uso | HEX | De dónde sale |
|---|---|---|
| Negro de fondo | `#030303` → `#000000` | Fondo de todas las páginas de la cartilla y del isotipo |
| Mármol (vetas) | `#1A1A1A`–`#5A5A5A` sobre negro | Portada y publicaciones "El antojo tiene otra forma" |
| Blanco de marca | `#FFFFFF` | Pez, luna, wordmark, títulos y precios |
| **Dorado de marca** | **`#AE8B3D`** (rango `#A08038`–`#B08838`) | Punto del logo, filetes, "SUSHI & MARISCOS", "Puerto Peñasco, Sonora" |
| Dorado sombra | `#786028` | Sombra del dorado en portadas de historias |
| Gris de texto secundario | `#BDBDBD` aprox. | Descripciones de platillos en la cartilla |

Colores del lugar (no son de marca, pero definen el ambiente de las fotos):

- **Madera cálida** de listones en fachada y paredes (`#8A5A33` aprox.).
- **Luz azul LED** del interior (`#2F6BD8` aprox.), muy presente en fotos de clientes y reels.
- Mesas de madera oscura, sillas negras, plantas.

No hay rojo, verde ni otro color de acento en la identidad. La marca es **negro + blanco + dorado**.

## 3. Tipografías identificadas

Leídas de las fuentes incrustadas en el PDF (Canva):

| Fuente | Uso en la cartilla |
|---|---|
| **Poppins** Bold / SemiBold | Títulos de sección en mayúsculas con mucho tracking ("ROLLOS ESPECIALES"), nombres de platillos y precios |
| **Poppins** Regular / Light / Italic | Descripciones, gramajes, textos al pie |
| **Montserrat** Regular / Bold | "Puerto Peñasco, Sonora" y datos secundarios |
| **Libre Baskerville** | Texto puntual (un solo uso) |
| Wordmark **MAKIZEN** | Es parte de la imagen del logo (serif romana tipo Cinzel/Trajan). No es una fuente del PDF; usar siempre la imagen. |

En las publicaciones de Instagram usan además una **script caligráfica** dorada ("¡Muchas Felicidades!", "Trick or Treat") y una serif con itálica ("El antojo tiene otra forma"). Son plantillas de Canva, no una fuente de marca fija.

## 4. Estética, temática y estilo

- **Concepto**: "Sushi & Mariscos **estilo Sinaloa**" / "al estilo **Sinaloense**". Lo dicen en la bio, en la cartilla y en los posts. Nombres de rollos con orgullo regional: **Culichi, Mazatleco, Guamuchilito, Sinaloa, Zarandeado, Peñasco**.
- **Toque japonés**: la portada de la cartilla dice **一期一会** (*ichigo ichie*, "cada encuentro es único"), el betta, la luna en pincelada, marcos con grecas chinas doradas en las historias, bebidas asiáticas (sake, soju, ramune, Sapporo).
- **Look**: oscuro, elegante, "de lujo accesible". Mármol negro, dorado fino, platillos fotografiados **recortados sin fondo** sobre negro, en platos negros o de piedra gris. En la cartilla, foto a la izquierda y lista con filetes dorados a la derecha.
- **Local**: fachada moderna negra con listones de madera y letras corpóreas, en la plaza de la gasolinera **Las Conchas** (Blvd. Freemont y Blvd. Josefa Ortiz). Interior con madera, iluminación azul y el logo retroiluminado.
- **Fotografía**: dos registros. (1) Producto de estudio con fondo negro o mármol, muy contrastado. (2) Reels con celular, de clientes e influencers locales, con luz azul del lugar.
- **Tono de voz**: cercano, cálido y antojadizo, en español mexicano, con emojis (🍣🦐🔥👀). Frases tipo "Se vale antojarse, ¿pero ya se te antojó?", "Crujientito, cremoso…", "Hay momentos que se disfrutan más cuando se comparten". Celebraciones (cumpleaños), Halloween, brindis. Cierre de la cartilla: "Buena comida • Buenos momentos • Siempre aquí" y "¡Presume tu antojo! Etiquétanos".
- **Hashtags**: #Makizen #SushiLovers #SushiTime #Foodie #AntojoDeSushi #PuertoPeñasco #HalloweenEnMakizen #estilosinaloa.

## 5. Público objetivo (según publicaciones y comentarios)

- **Locales de Puerto Peñasco**: familias, grupos de amigas, parejas, celebraciones de cumpleaños (varios posts "Muchas felicidades").
- **Creadores y foodies locales** que hacen reels (La Foodie MX, influencers de Peñasco) y destacan: **camarón roca, aguachiles, tostadas de atún, rollos sinaloenses**, mixología "10/10", "precios súper justos", "ambiente muy bonito" y "servicio excelente".
- **Turismo nacional** (Sonora, BC) y **turistas de Arizona / snowbirds**: un post de inauguración está en inglés ("Congratulations… for their grand opening"). Necesitan inglés y referencia en USD.
- Negocio **familiar** (los comentarios de la inauguración felicitan a "Tía Aida, tío Cristian y Tía Bianca").

## 6. Datos de operación (confirmados en la cartilla y perfiles)

- **Dirección**: Blvd. Freemont y Blvd. Josefa Ortiz, Puerto Peñasco, Sonora (plaza de la gasolinera Las Conchas). Instagram enlaza a Google Maps.
- **Teléfonos**: (638) 156-0660 (celular) · (638) 388-2836 (fijo, para domicilio).
- **Horario**: Lun, Mié y Jue 1:00–9:00 pm · Vie, Sáb y Dom 1:00–10:00 pm · **martes cerrado**.
- **Pago**: "Aceptamos efectivo y tarjetas".
- **Servicio a domicilio**: sí, por teléfono (historia "Domicilio 📍": "¡Sin salir de casa! Tu sushi favorito").
- La cartilla incluye un **código QR** en la pág. 9.

## 7. Menú real (cartilla, 10 páginas)

Precios en MXN tal como aparecen. Ya cargado en `src/data/menu.json` con traducción al inglés.

**Entradas** — Triángulos de Marlín $90 · Rollos Primavera de Camarón $80 · Chile Caribe Especial $105 · Sashimi Mixto $140 · **Camarón Roca $210** · Sopa Vietnamita de Pollo o Camarón $160 · Curricanes $180

**Tostadas, aguachiles y cócteles** — Tostada de Ceviche (70 g) $110 · **Tostada de Atún (100 g) $120** · Tostada Especial (90 g) $150 · **Aguachile Mixto $280** · Coctel de Camarón $220 · Camarón con Pulpo $260

**Arroces** — Bomba Especial $180 · Yakimeshi Especial $190 · Gohan Especial $170

**Rollos naturales** — Tuna Roca Roll $220 · Avocado Roll $210 · Fresh Roll $230

**Rollos clásicos** — Mar y Tierra $180 · Chicken $170 · Tres Quesos $180 · Guamuchilito $190

**Rollos horneados** — Especial Roll $240 · Culichi Roll $180 · Zarandeado Roll $240

**Rollos empanizados** — Mazatleco Roll $200 · Serrano Roll $170

**Rollos especiales** — Sinaloa Roll Natural $230 · Futomaki Roll Capeado $210 · Tataki Roll $230 · Makizen Roll Empanizado $240 · Peñasco Roll $230

**Guisos** — Teriyaki Crispy $170 · Teppanyaki Mixto (camarón, pollo) $190 · Res en Pasta Udon $170

**Charolas** — Sencilla $445 (Chile especial, Chicken, Guamuchilito roll) · Mediana $900 (Bomba especial, Tuna roca, Mazatleco, Peñasco roll) · Premium $1,100 (Teriyaki crispy, Especial, Avocado, Serrano, Makizen roll)

**Menú kids** — Tender con Papas $130 · Dedos de Queso $120 · Rollo Kids $130

**Postres** — Helado en Tempura de la Casa $110

**Vasos preparados** (no incluyen cerveza) — Vaso Michelado $20 · Vaso con Clamato Preparado $40 · Vaso Cubano $35

**Cervezas nacionales e importadas** — Pacífico Clara $40 · Pacífico Suave $40 · Michelob Ultra $45 · Modelo Especial $45 · Modelo Negra $45 · Corona $45 · Tecate Light $40 · Tecate Roja $40 · Bohemia Clara $45 · Bohemia Negra $45

**Mixología de la casa** — Mojito Cubano $120 · Mojito de Mango $130 · Mojito de Frutos $130 · Mezcalita de Fresa $125 · Mezcalita de Mango $135 · Clericot $125 · Carajillo con Licor 43 $120 · Gin de Frutos Rojos $120 · Gin de Pepino $120

**Bebidas asiáticas** — Sake Sayuri Junmai $450 · Hanagoi Sparkling $600 · Soju Jun Ho (piña, durazno, zarzamora, ciruela china) $300 · Ramune Shirakiku (fresa, melón) $95 · Cerveza Sapporo 355 ml $80

**Bebidas sin alcohol** — Vaso con Té Helado (refill) $60 · Limonada Natural $40 · Limonada Mineral $45 · Limonada Fresa Limón $45 · Agua Embotellada e-pura $35

**Refrescos** — Coca-Cola, Coca-Cola Light, Sprite, Fanta Naranja, Manzana Mundet, Fresca: $50 c/u

**Shots** — Tequila $95 · Mezcal $100 · Whisky Etiqueta Negra $110

**Makizen** — Granizado del día $110 ("¡Pregunta por el granizado del día!")

Erratas de la cartilla que corregimos en el menú digital: "Michaelob" → Michelob, "Tkt" → Tecate, "surmi" → surimi, "acompñada" → acompañada, "covertura" → cobertura, "nuguets" → nuggets. Tres Quesos dice "Res, empanizado" en la cartilla: confirmar con el negocio.

Fotos: la cartilla trae **22 fotos de producto recortadas** (sin fondo). Se usaron en la demo (`public/menu/`). Platillos **sin foto** (entre ellos el **Camarón Roca**, el más mencionado en reseñas): Rollos Primavera, Chile Caribe, Camarón Roca, Sopa, Curricanes, Tostada de Ceviche, Tostada Especial, cócteles, Yakimeshi, Gohan, Avocado, Fresh, clásicos (salvo Guamuchilito), Especial, Zarandeado, Mazatleco, Sinaloa, Tataki, Peñasco, Teppanyaki, Udon, Charolas Sencilla/Mediana, Tender, Rollo Kids, vasos y cervezas nacionales. En la demo se muestran con el isotipo como marcador.

## 7 bis. Fotografía real tomada de sus redes (8 nov 2026)

Las fotos se descargaron en su **resolución original de Instagram**: las publicaciones en 1080 × 1350 (la fachada nocturna en 1350 × 1688) y los cuadros de reel extraídos del video a 1080 × 1920. No son capturas de pantalla. Solo se usaron publicaciones y reels **del propio negocio**. A las plantillas de Canva se les recortaron los textos y a los reels, los subtítulos. Se evitaron cuadros con caras de clientes o de influencers. Están en `public/fotos/` en WebP a 640 y 1080 px (`srcset`); el origen de cada una está en `src/data/fotos-redes.json`.

| Archivo | De dónde sale | Uso en la demo |
|---|---|---|
| `mesa-cenital` | Carrusel "El antojo tiene otra forma" (29 oct), foto de estudio cenital | Portada; cabecera de Entradas |
| `sashimi`, `gin-pepino` | Recortes de la foto cenital | Favoritos; detalle del Sashimi y del Gin de Pepino |
| `rollo-corona` | Mismo carrusel, rollo en corona sobre mármol | Rollos naturales |
| `serrano`, `serrano-palillos` | Mismo carrusel ("Un bocado y cambia todo") | Favoritos; rollos empanizados; detalle del Serrano Roll |
| `mas-sabores` | Mismo carrusel ("Más sabores, más razones para volver") | Rollos especiales |
| `bocado` | Mismo carrusel ("El placer está en los pequeños detalles") | Reserva |
| `aguachile` | Reel: aguachile de cerca | Favoritos; tostadas y aguachiles; detalle |
| `makizen-roll` | Reel: Makizen Roll con palillos | Favoritos; detalle |
| `rollos-plato` | Reel: plato de rollos con aguachile | Reserva |
| `udon` | Reel de apertura (8 oct): res en pasta udon | Guisos; detalle |
| `muro-coctel`, `muro-logo` | Reel: muro con el isotipo y "MAKIZEN" retroiluminados | Mixología; Visítanos |
| `fachada-frente`, `fachada-lado` | Reel de apertura: fachada con letrero encendido al atardecer | Visítanos |
| `fachada-noche` | Publicación de Halloween (31 oct), render nocturno de la fachada | Visítanos |

Confirmado en las fotos: **interior con muros azules**, mesas de madera, sillas de madera curva, **muro negro con el isotipo y "MAKIZEN" retroiluminados** y barra de cocteles. La fachada combina paneles negros con listones de madera y el logo en un disco iluminado.

Pendiente: para producción conviene pedir al negocio los archivos originales sin comprimir y su permiso de uso por escrito.

## 8. Lo que NO existe o no encontramos

- **Etiquetas de picante, crudo, alérgenos**: la cartilla no las trae. En `menu.json` están **inferidas de la descripción** (p. ej. "chile serrano", "jalapeño", "chile de árbol", "spicy" → picante; "curtido en limón", "atún natural" → crudo/curtido) y marcadas con `"etiquetasInferidas": true`. **Hay que validarlas con la cocina.**
- **"Favorito"**: viene de lo que más mencionan las reseñas (camarón roca, aguachile, tostada de atún, rollos sinaloenses). "Nuevo": no lo usan.
- **Agotado**: en la demo hay un platillo marcado como agotado **solo para mostrar el estado** (`"demo": true`).
- **Inglés**: el negocio no tiene menú en inglés; las traducciones son nuestras.
- **Tipo de cambio**: el negocio no publica precio en USD. La demo usa una referencia configurable en `menu.json` (`tipoCambioReferencia`), mostrada como "≈ referencia".
- **Logo en vector, manual de marca, Pantone**: no existen públicamente.
- **Reseñas en Facebook/Google**: 0 opiniones en Facebook al 8 nov 2026.
