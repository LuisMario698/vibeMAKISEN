// Guía del comensal: «pistas en el momento». Lógica pura (sin DOM): qué pista toca, cuándo,
// en qué orden y si ya se vio. La interfaz vive en src/scripts/guia.ts.
//
// Reglas:
//  · Cada pista sale UNA sola vez (se marca al mostrarse) y no vuelve tras recargar.
//  · Si la persona ya usó la función, la pista se da por vista sin mostrarse.
//  · Nunca dos a la vez: una cola con prioridad; entre una y otra hay un respiro.
//  · Lo que espera demasiado en la cola caduca (su momento ya pasó; su disparador la volverá a pedir).
//  · No sale en modo presentación (?demo=1) ni con ?guia=0 (que se recuerda en la sesión).
//  · Lo visto caduca a los 180 días: quien vuelve meses después ve las pistas otra vez.

/** Pistas flotantes (van por la cola) y realces en su lugar (se marcan, no esperan turno). */
export const PISTAS = ['bienvenida', 'isla', 'pedido', 'agregar', 'busqueda'] as const;
export const REALCES = ['filtros', 'hoja', 'pasos', 'camaron'] as const;
export type Pista = (typeof PISTAS)[number];
export type Realce = (typeof REALCES)[number];
export type GuiaId = Pista | Realce;
const IDS: readonly string[] = [...PISTAS, ...REALCES];
const esId = (x: string): x is GuiaId => IDS.includes(x);

export const CLAVE = 'makizen-guia';
export const CLAVE_APAGADA = 'makizen-guia-off';
export const VERSION = 1;
export const CADUCIDAD_MS = 180 * 24 * 60 * 60 * 1000;
/** Respiro entre el final de una pista y la siguiente. */
export const RESPIRO_MS = 1200;

/** Orden de la cola (menor = antes). El pedido va antes que agregar y buscar: llega por una acción. */
export const PRIORIDAD: Record<Pista, number> = { bienvenida: 0, isla: 1, pedido: 2, agregar: 3, busqueda: 4 };
/** Cuánto se queda a la vista cada pista (se va antes si la tocan o usan la función). */
export const DURACION_MS: Record<Pista, number> = { bienvenida: 5000, isla: 5200, pedido: 5000, agregar: 4800, busqueda: 4800 };
/** Cuánto puede esperar en la cola antes de caducar. */
export const ESPERA_MAX_MS: Record<Pista, number> = { bienvenida: 8000, isla: 15000, pedido: 15000, agregar: 12000, busqueda: 20000 };

export type Estado = { v: typeof VERSION; vistas: Partial<Record<GuiaId, number>>; mesa?: number };

export const estadoVacio = (): Estado => ({ v: VERSION, vistas: {} });

/** Lee el estado guardado. Cualquier cosa rara (otra versión, JSON roto, fechas inválidas) se descarta. */
export function leerEstado(raw: string | null | undefined, ahora: number): Estado {
  if (!raw) return estadoVacio();
  let d: unknown;
  try { d = JSON.parse(raw); } catch { return estadoVacio(); }
  if (!d || typeof d !== 'object' || (d as { v?: unknown }).v !== VERSION) return estadoVacio();
  const o = d as { vistas?: unknown; mesa?: unknown };
  const vistas: Estado['vistas'] = {};
  if (o.vistas && typeof o.vistas === 'object') {
    for (const [k, t] of Object.entries(o.vistas as Record<string, unknown>)) {
      if (!esId(k) || typeof t !== 'number' || !Number.isFinite(t)) continue;
      // Caducado o con fecha en el futuro (reloj cambiado): como no visto.
      if (ahora - t > CADUCIDAD_MS || t > ahora + 60_000) continue;
      vistas[k] = t;
    }
  }
  const e: Estado = { v: VERSION, vistas };
  if (typeof o.mesa === 'number' && Number.isInteger(o.mesa) && o.mesa >= 1 && o.mesa <= 99) e.mesa = o.mesa;
  return e;
}

export const serializar = (e: Estado) => JSON.stringify(e);
export const visto = (e: Estado, id: GuiaId) => e.vistas[id] !== undefined;
export const marcar = (e: Estado, id: GuiaId, ahora: number): Estado => (visto(e, id) ? e : { ...e, vistas: { ...e.vistas, [id]: ahora } });
/**
 * «Ver las pistas otra vez»: todas las pistas y realces como nuevos. La bienvenida de mesa no es
 * una pista: se conserva (no se vuelve a dar la bienvenida a quien ya está sentado en esa mesa).
 */
export function reiniciar(e: Estado = estadoVacio()): Estado {
  const n = estadoVacio();
  if (e.vistas.bienvenida !== undefined) n.vistas.bienvenida = e.vistas.bienvenida;
  if (e.mesa !== undefined) n.mesa = e.mesa;
  return n;
}

/** ¿Corre la guía? Nunca en modo presentación ni con ?guia=0 (o si ya se apagó en esta sesión). */
export function guiaActiva(search: string, apagadaEnSesion = false): boolean {
  const q = new URLSearchParams(search);
  if (q.get('demo') === '1' || q.get('guia') === '0') return false;
  return !apagadaEnSesion;
}
/** ¿Hay que recordar en la sesión que la guía va apagada? (?guia=0; ?guia=1 la vuelve a encender). */
export function apagarEnSesion(search: string): boolean | null {
  const g = new URLSearchParams(search).get('guia');
  return g === '0' ? true : g === '1' ? false : null;
}

/** Bienvenida de mesa: solo si llegaron por QR de mesa y no se dio ya para esa misma mesa. */
export const tocaBienvenida = (e: Estado, mesaQR: number | null) => mesaQR !== null && !(visto(e, 'bienvenida') && e.mesa === mesaQR);
/** Al darla se recuerda la mesa (otra mesa, otro día, otra bienvenida). */
export const marcarBienvenida = (e: Estado, mesa: number, ahora: number): Estado => ({ ...e, mesa, vistas: { ...e.vistas, bienvenida: ahora } });
/** Si llegan por el QR de otra mesa, la bienvenida anterior ya no cuenta (para que pueda encolarse). */
export function prepararBienvenida(e: Estado, mesaQR: number | null): Estado {
  if (mesaQR === null || !visto(e, 'bienvenida') || e.mesa === mesaQR) return e;
  const { bienvenida: _, ...resto } = e.vistas;
  return { ...e, vistas: resto };
}

/**
 * Buscar y filtros: no en cuanto aparece la isla (ahí ya sale su pista), sino cuando la persona
 * muestra que está explorando: tras pasar por dos secciones, o tras 20 s de recorrer la carta.
 * Así no se encima a la de la isla y llega cuando buscar ya sirve. Siempre después de la de la isla.
 */
export const BUSQUEDA = { cambios: 2, ms: 20_000 } as const;
export function tocaBusqueda(o: { islaVista: boolean; cambios: number; msConIsla: number }): boolean {
  return o.islaVista && (o.cambios >= BUSQUEDA.cambios || o.msConIsla >= BUSQUEDA.ms);
}

/* ── Cola: nunca dos a la vez ───────────────────────────────────────── */
export type EnCola = { id: Pista; desde: number };
export type Cola = readonly EnCola[];

/** Pide turno. Se ignora si ya se vio, ya está en la cola o es la que está a la vista. */
export function encolar(cola: Cola, id: Pista, ahora: number, e: Estado, actual: Pista | null = null): Cola {
  if (visto(e, id) || actual === id || cola.some((x) => x.id === id)) return cola;
  return [...cola, { id, desde: ahora }].sort((a, b) => PRIORIDAD[a.id] - PRIORIDAD[b.id] || a.desde - b.desde);
}

/** Quita de la cola lo ya visto y lo que esperó de más. */
export const depurar = (cola: Cola, ahora: number, e: Estado): Cola =>
  cola.filter((x) => !visto(e, x.id) && ahora - x.desde <= ESPERA_MAX_MS[x.id]);

/**
 * ¿Qué pista sale ahora? Ninguna si hay una a la vista, si la página está ocupada (intro, un
 * panel o diálogo abierto, pestaña oculta) o si no ha pasado el respiro desde la anterior.
 */
export function siguiente(cola: Cola, ahora: number, ctx: { e: Estado; actual: Pista | null; ocupada: boolean; ultimaTermino: number }): { id: Pista | null; cola: Cola } {
  const limpia = depurar(cola, ahora, ctx.e);
  if (ctx.actual || ctx.ocupada || ahora - ctx.ultimaTermino < RESPIRO_MS || !limpia.length) return { id: null, cola: limpia };
  return { id: limpia[0]!.id, cola: limpia.slice(1) };
}

/* ── Textos (cortos y cálidos). El nombre de la función, igual que en la interfaz. ── */
export type Idioma = 'es' | 'en';
export type TextoPista = { titulo: string; detalle: string };
export function textoPista(id: Pista, idioma: Idioma, o: { mesa?: number | null; tactil?: boolean } = {}): TextoPista {
  const es = idioma === 'es';
  const mesa = o.mesa ?? null;
  switch (id) {
    case 'bienvenida':
      return es
        ? { titulo: `Mesa ${mesa ?? ''}`.trim(), detalle: 'Pide desde aquí y te lo llevamos' }
        : { titulo: `Table ${mesa ?? ''}`.trim(), detalle: "Order from here and we'll bring it to you" };
    case 'isla':
      return es
        ? { titulo: 'Toca para ver todas las secciones', detalle: o.tactil === false ? 'Arrastra ⇆ o usa las flechas para pasar a la siguiente' : 'Desliza ⇆ para pasar a la siguiente' }
        : { titulo: 'Tap to see every section', detalle: o.tactil === false ? 'Drag ⇆ or use the arrow keys to move to the next one' : 'Swipe ⇆ to move to the next one' };
    case 'busqueda':
      return es
        ? { titulo: 'Busca un platillo o ingrediente', detalle: 'Y filtra: Favoritos, Sin picante o Cocido' }
        : { titulo: 'Search for a dish or ingredient', detalle: 'Then filter: Favorites, Not spicy or Cooked' };
    case 'agregar':
      return es
        ? { titulo: 'Toca un platillo para ver opciones y agregarlo', detalle: 'En bebidas, el + las agrega directo' }
        : { titulo: 'Tap a dish to see options and add it', detalle: 'For drinks, + adds them right away' };
    case 'pedido':
      return es
        ? { titulo: 'Tu pedido está aquí', detalle: mesa ? `Envíalo por WhatsApp y te lo llevamos a la mesa ${mesa}` : 'Revísalo y envíalo por WhatsApp' }
        : { titulo: 'Your order is right here', detalle: mesa ? `Send it on WhatsApp and we'll bring it to table ${mesa}` : 'Review it and send it on WhatsApp' };
  }
}

/* ── Dónde se pone una pista respecto a lo que explica ──────────────── */
export type Caja = { x: number; y: number; w: number; h: number };
export type Lado = 'arriba' | 'abajo';
/**
 * Coloca la tarjeta junto a su ancla sin taparla: del lado pedido si cabe (si no, del otro),
 * dentro de la pantalla con un margen, y devuelve dónde cae el hilo dorado (x dentro de la
 * tarjeta) para que apunte al centro del ancla. `alinear: 'inicio'` alinea con el borde izquierdo.
 */
export function colocar(o: { ancla: Caja; tam: { w: number; h: number }; vista: { w: number; h: number }; lado: Lado; hueco?: number; margen?: number; alinear?: 'centro' | 'inicio' | 'fin' | undefined }): { x: number; y: number; lado: Lado; hilo: number } {
  const hueco = o.hueco ?? 16;
  const m = o.margen ?? 12;
  const { ancla: a, tam: t, vista: v } = o;
  const arriba = a.y - hueco - t.h;
  const abajo = a.y + a.h + hueco;
  const cabeArriba = arriba >= m;
  const cabeAbajo = abajo + t.h <= v.h - m;
  const lado: Lado = o.lado === 'arriba' ? (cabeArriba || !cabeAbajo ? 'arriba' : 'abajo') : (cabeAbajo || !cabeArriba ? 'abajo' : 'arriba');
  const cx = a.x + a.w / 2;
  const deseado = o.alinear === 'inicio' ? a.x : o.alinear === 'fin' ? a.x + a.w - t.w : cx - t.w / 2;
  const x = Math.round(Math.max(m, Math.min(v.w - m - t.w, deseado)));
  const y = Math.round(lado === 'arriba' ? arriba : abajo);
  const hilo = Math.round(Math.max(20, Math.min(t.w - 20, cx - x)));
  return { x, y, lado, hilo };
}
