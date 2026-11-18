// Modo presentación (?demo=1): el guion como datos y la lógica pura de secuencia,
// tiempos, pausa, trayectoria del cursor y avance. Sin DOM: se prueba con vitest.
// Quien lo ejecuta sobre la interfaz real es src/scripts/presentacion.ts.

export type Txt = { es: string; en: string };
export type Punto = { x: number; y: number };

/**
 * Una acción sobre la interfaz real. `sel` es el selector principal; `alternativas`, los que
 * se prueban si el primero no está a la vista. `si`: solo se hace si ese selector existe
 * (permite saltar lo que ya está hecho). `opcional`: si falla, el paso sigue.
 * `pausa` (ms) es lo que se queda quieto después, para que se alcance a ver y leer.
 */
export type Accion =
  | { hacer: 'esperar'; ms: number }
  | { hacer: 'desplazar'; sel: string; bloque: 'start' | 'center'; ms: number; pausa: number }
  | { hacer: 'tocar'; sel: string; alternativas?: string[]; si?: string; opcional?: boolean; pausa: number }
  | { hacer: 'escribir'; sel: string; texto: Txt; msLetra: number; pausa: number }
  | { hacer: 'deslizar'; sel: string; dir: -1 | 1; pausa: number }
  | { hacer: 'esperarA'; sel: string; ms: number };

/**
 * Qué se cierra antes de empezar el paso (con sus botones reales): nada; los paneles de la isla;
 * la isla y el detalle (se conserva «Mi pedido»); o todo, incluido «Mi pedido».
 */
export type Limpieza = 'nada' | 'isla' | 'pedido' | 'capas';

export type Paso = { id: string; titulo: Txt; linea: Txt; limpia: Limpieza; acciones: Accion[] };

/** Tiempo para leer el subtítulo nuevo antes de la primera acción del paso. */
export const LECTURA = 700;
/** Estimado de un toque: llegar con el cursor (≈ 650 ms) más el toque (≈ 250 ms). */
export const MS_TOQUE = 900;
export const MS_DESLIZAR = 1300;

/**
 * El recorrido: portada → isla → búsqueda → agregar → bebida → comanda → entrega → pago → envío.
 * Todos los selectores son de la interfaz real (Isla.astro, Hoja.astro, Lista.astro, Nav.astro).
 * El platillo es el Camarón Roca (favorito de las reseñas) y la bebida, una Pacífico (Sinaloa).
 */
export const GUION: Paso[] = [
  {
    id: 'portada',
    titulo: { es: 'Abre con el QR', en: 'Scan and it opens' },
    linea: { es: 'Tu marca, el horario de hoy y si está abierto.', en: 'Your brand, today’s hours and whether you’re open.' },
    limpia: 'nada',
    acciones: [
      { hacer: 'esperar', ms: 2200 },
      { hacer: 'desplazar', sel: '.hoy-mk', bloque: 'center', ms: 1600, pausa: 2200 },
      { hacer: 'desplazar', sel: '#menu', bloque: 'start', ms: 1500, pausa: 900 },
    ],
  },
  {
    id: 'secciones',
    titulo: { es: 'Explora las secciones', en: 'Browse the sections' },
    linea: { es: 'Toca la isla para elegir; deslízala para pasar a la siguiente.', en: 'Tap the bar to pick one; swipe it to move to the next.' },
    limpia: 'capas',
    acciones: [
      { hacer: 'tocar', sel: '.isla-pildora', pausa: 1200 },
      { hacer: 'tocar', sel: '#isla-panel [data-ir="rollos-especiales"]', alternativas: ['#isla-panel [data-ir]'], pausa: 1400 },
      { hacer: 'deslizar', sel: '.isla-pildora', dir: -1, pausa: 1400 },
    ],
  },
  {
    id: 'busqueda',
    titulo: { es: 'Busca y filtra', en: 'Search and filter' },
    linea: { es: 'Por platillo o ingrediente, con filtros de un toque.', en: 'By dish or ingredient, with one-tap filters.' },
    limpia: 'capas',
    acciones: [
      { hacer: 'tocar', sel: '.isla-lupa', pausa: 500 },
      { hacer: 'escribir', sel: '#buscar', texto: { es: 'camarón', en: 'shrimp' }, msLetra: 130, pausa: 600 },
      { hacer: 'tocar', sel: '#isla-busca [data-filtro="favorito"]', pausa: 1500 },
      { hacer: 'tocar', sel: '#isla-busca [data-platillo="camaron-roca"]', alternativas: ['#isla-busca li:not([hidden]) [data-platillo]'], pausa: 1500 },
      { hacer: 'esperarA', sel: '#hoja[open]', ms: 2500 },
    ],
  },
  {
    id: 'agregar',
    titulo: { es: 'Agrega al pedido', en: 'Add to the order' },
    linea: { es: 'Elige cuántos y el platillo vuela a «Mi pedido».', en: 'Pick how many and the dish flies to “My order”.' },
    limpia: 'isla',
    acciones: [
      // Si el paso anterior no llegó a abrir el detalle, se abre desde su tarjeta.
      { hacer: 'tocar', sel: '[data-abrir="camaron-roca"]', si: '#hoja:not([open])', opcional: true, pausa: 1400 },
      { hacer: 'tocar', sel: '#hoja[open] #hoja-opciones label', opcional: true, si: '#hoja[open] #hoja-opciones', pausa: 600 },
      { hacer: 'tocar', sel: '#hoja[open] [data-mas]', pausa: 700 },
      { hacer: 'tocar', sel: '#hoja[open] #hoja-agregar', pausa: 2000 },
      { hacer: 'esperarA', sel: '#hoja:not([open])', ms: 3000 },
    ],
  },
  {
    id: 'bebida',
    titulo: { es: 'Bebidas en un toque', en: 'Drinks in one tap' },
    linea: { es: 'El «+» agrega la bebida sin abrirla.', en: 'The “+” adds a drink without opening it.' },
    limpia: 'capas',
    acciones: [
      { hacer: 'tocar', sel: '.isla-pildora', pausa: 900 },
      { hacer: 'tocar', sel: '#isla-panel [data-ir="cervezas"]', pausa: 1200 },
      { hacer: 'tocar', sel: '[data-agregar="pacifico-clara"]', alternativas: ['#cervezas [data-agregar]', '[data-agregar]'], pausa: 2000 },
    ],
  },
  {
    id: 'comanda',
    titulo: { es: 'Revisa la comanda', en: 'Review the order' },
    linea: { es: 'Platillos, cantidades, notas y total en pesos.', en: 'Dishes, quantities, notes and the total in pesos.' },
    limpia: 'capas',
    acciones: [
      // Pedido vacío (se saltaron pasos): una bebida para que el resto del recorrido tenga qué mostrar.
      { hacer: 'tocar', sel: '[data-agregar="pacifico-clara"]', alternativas: ['[data-agregar]'], si: '#nav .nav-contador[hidden]', opcional: true, pausa: 1400 },
      // Antes del paso se cerró todo («capas»): «Mi pedido» se abre desde el carrito de arriba.
      { hacer: 'tocar', sel: '#nav [data-abrir-lista]', pausa: 3200 },
    ],
  },
  {
    id: 'entrega',
    titulo: { es: 'Elige la mesa', en: 'Pick the table' },
    linea: { es: 'En mesa, para llevar o a domicilio; la mesa, en el plano.', en: 'Dine-in, pickup or delivery; the table, on the floor plan.' },
    limpia: 'pedido',
    acciones: [
      { hacer: 'tocar', sel: '#nav [data-abrir-lista]', si: '#lista:not([open])', pausa: 900 },
      { hacer: 'tocar', sel: '#pd-seguir', si: '#lista[data-paso="1"]', pausa: 1000 },
      { hacer: 'tocar', sel: '#lista label.modo:has(input[value="mesa"])', pausa: 900 },
      { hacer: 'tocar', sel: '#pd-abrir-plano', pausa: 1200 },
      { hacer: 'tocar', sel: '#lista .pd-mesa[data-mesa="5"]:not([data-ocupada="si"])', alternativas: ['#lista .pd-mesa:not([data-ocupada="si"])'], pausa: 1100 },
      { hacer: 'tocar', sel: '#pd-plano-listo', pausa: 800 },
    ],
  },
  {
    id: 'pago',
    titulo: { es: 'Paga al recibir', en: 'Pay on arrival' },
    linea: { es: 'Efectivo o tarjeta; con efectivo avisan con cuánto pagan.', en: 'Cash or card; with cash they say which bill they’ll use.' },
    limpia: 'pedido',
    acciones: [
      { hacer: 'tocar', sel: '#pd-seguir', si: '#lista[data-paso="2"]', pausa: 1000 },
      { hacer: 'tocar', sel: '#lista label.pago:has(input[value="efectivo"])', pausa: 900 },
      { hacer: 'tocar', sel: '#lista label.pd-chip:has(input[name="paga"][value="500"])', alternativas: ['#lista label.pd-chip:has(input[name="paga"]):not(:has([value="exacto"])):not(:has([value="otro"]))'], pausa: 1500 },
    ],
  },
  {
    id: 'enviar',
    titulo: { es: 'Envía por WhatsApp', en: 'Send on WhatsApp' },
    linea: { es: 'Te llega con folio y el cliente ve su seguimiento.', en: 'It reaches you with an order number, and the guest can track it.' },
    limpia: 'pedido',
    acciones: [
      { hacer: 'tocar', sel: '#lista-enviar', pausa: 4200 },
    ],
  },
];

/** Tarjeta final: tres beneficios, en el idioma activo. */
export const CIERRE = {
  titulo: { es: 'Así se vería MAKIZEN digital', en: 'This is MAKIZEN, digital' },
  beneficios: [
    { es: 'Pedidos claros y ordenados por WhatsApp', en: 'Clear, organized orders on WhatsApp' },
    { es: 'Menú siempre al día: precios y agotados', en: 'A menu that’s always current: prices and sold-out items' },
    { es: 'En español e inglés, para turistas', en: 'In Spanish and English, for visitors' },
  ],
  nota: { es: 'Demostración: no se envió ningún pedido.', en: 'Demo: no order was sent.' },
  otraVez: { es: 'Ver otra vez', en: 'Watch again' },
  explorar: { es: 'Explorar yo mismo', en: 'Explore it myself' },
} as const;

/* ── Tiempos ───────────────────────────────────────────────────────── */

/** Lo que tarda (estimado) una acción, sin escalar. Esperas por condición: la mitad de su tope. */
export function duracionAccion(a: Accion): number {
  switch (a.hacer) {
    case 'esperar': return a.ms;
    case 'desplazar': return a.ms + a.pausa;
    case 'tocar': return MS_TOQUE + a.pausa;
    case 'escribir': return Math.max(a.texto.es.length, a.texto.en.length) * a.msLetra + a.pausa;
    case 'deslizar': return MS_DESLIZAR + a.pausa;
    case 'esperarA': return 0;
  }
}

/** Duración nominal de un paso (la usa la barra de avance). Las acciones condicionales (`si`) no cuentan: casi nunca ocurren. */
export const duracionPaso = (p: Paso) => LECTURA + p.acciones.reduce((s, a) => s + ('si' in a && a.si ? 0 : duracionAccion(a)), 0);

export const duracionTotal = (g: Paso[] = GUION) => g.reduce((s, p) => s + duracionPaso(p), 0);

/** Factor de tiempo: 1 normal; ?rapido=1 (solo para pruebas) lo acelera. */
export const escalaDe = (search: string) => (new URLSearchParams(search).get('rapido') === '1' ? 0.12 : 1);

/**
 * Avance total (0–1): pasos completos más la fracción del actual según el tiempo que lleva.
 * Nunca llega a 1 antes del último paso (la fracción se topa en 0.98).
 */
export function progreso(g: Paso[], indice: number, msEnPaso: number, escala = 1): number {
  if (indice >= g.length) return 1;
  if (indice < 0) return 0;
  const total = duracionTotal(g);
  if (total <= 0) return 0;
  const antes = g.slice(0, indice).reduce((s, p) => s + duracionPaso(p), 0);
  const actual = duracionPaso(g[indice]!);
  const fraccion = actual > 0 ? Math.min(0.98, Math.max(0, msEnPaso / (actual * escala))) : 0;
  return (antes + fraccion * actual) / total;
}

/** "3/9". */
export const numeroPaso = (indice: number, total = GUION.length) => `${indice + 1}/${total}`;

/* ── Reloj con pausa ───────────────────────────────────────────────── */

/** Tiempo corrido sin contar las pausas. `ahora` se inyecta (performance.now en el navegador). */
export function crearReloj(ahora: () => number) {
  let base = ahora();
  let acumulado = 0;
  let pausado = false;
  return {
    get pausado() { return pausado; },
    transcurrido: () => (pausado ? acumulado : acumulado + ahora() - base),
    pausar() { if (pausado) return false; acumulado += ahora() - base; pausado = true; return true; },
    reanudar() { if (!pausado) return false; base = ahora(); pausado = false; return true; },
  };
}
export type Reloj = ReturnType<typeof crearReloj>;

/* ── Cursor ────────────────────────────────────────────────────────── */

/** Ida y vuelta suave (aceleración y frenado), como mueve la mano. */
export const suave = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Cuánto tarda el cursor en ir de un punto a otro: más lejos, más tiempo, con topes. */
export function duracionMovimiento(desde: Punto, hasta: Punto): number {
  const d = Math.hypot(hasta.x - desde.x, hasta.y - desde.y);
  return Math.round(Math.min(950, Math.max(420, 360 + d * 0.55)));
}

/**
 * Trayectoria en curva (Bézier cuadrática con el control desplazado a un lado), muestreada en
 * `n + 1` puntos a tiempos iguales con aceleración y frenado. `lado` (1 o -1) alterna la curva.
 */
export function trayectoria(desde: Punto, hasta: Punto, n = 18, lado: 1 | -1 = 1): Punto[] {
  const dx = hasta.x - desde.x;
  const dy = hasta.y - desde.y;
  const d = Math.hypot(dx, dy);
  const curva = Math.min(90, d * 0.18) * lado;
  const c = { x: (desde.x + hasta.x) / 2 - (dy / (d || 1)) * curva, y: (desde.y + hasta.y) / 2 + (dx / (d || 1)) * curva };
  const pts: Punto[] = [];
  for (let i = 0; i <= n; i++) {
    const t = suave(i / n);
    const u = 1 - t;
    pts.push({ x: u * u * desde.x + 2 * u * t * c.x + t * t * hasta.x, y: u * u * desde.y + 2 * u * t * c.y + t * t * hasta.y });
  }
  return pts;
}

/* ── Enlaces y URL ─────────────────────────────────────────────────── */

/** Lo que la demostración nunca abre: WhatsApp, llamadas y mapas externos. */
export function esEnlaceExterno(href: string): boolean {
  return /^(https?:\/\/(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|maps\.app\.goo\.gl|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+\/maps)|tel:|sms:|whatsapp:|geo:)/i.test(href.trim());
}

/** La misma dirección sin ?demo ni ?rapido (ni el #sección que fue dejando el recorrido). */
export function urlSinDemo(href: string): string {
  const u = new URL(href);
  u.searchParams.delete('demo');
  u.searchParams.delete('rapido');
  return u.pathname + u.search;
}

/** La dirección para ver la demostración otra vez desde la portada (conserva ?rapido). */
export function urlDemo(href: string): string {
  const u = new URL(href);
  u.hash = '';
  u.searchParams.set('demo', '1');
  return u.pathname + u.search;
}
