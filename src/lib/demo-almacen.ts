// Almacén aislado del modo presentación (?demo=1). Durante la demostración las claves del
// pedido viven en memoria: el carrito, el seguimiento y la mesa reales del teléfono no se
// leen ni se escriben, y al salir (o al cerrar la pestaña) siguen exactamente como estaban.
// Lógica pura: se prueba con vitest. src/scripts/aislar.ts la conecta con localStorage/sessionStorage.
// Va aparte de src/lib/presentacion.ts para que el guion no entre al paquete del uso normal.

/** ¿La dirección pide el modo presentación? */
export const esDemo = (search: string) => new URLSearchParams(search).get('demo') === '1';

/** Claves que toca el recorrido (Mi pedido, seguimiento, mesa, modalidad, idioma elegido) y las de la
 *  guía del comensal (lo visto y el apagado de la sesión): si durante la demo alguien abre «¿Cómo pido?»
 *  y toca «Ver las pistas otra vez», tampoco queda rastro. */
export const CLAVES_AISLADAS = ['makizen-lista', 'makizen-pedido', 'makizen-mesa', 'makizen-mesa-qr', 'makizen-modo-elegido', 'makizen-reabrir', 'makizen-idioma', 'makizen-guia', 'makizen-guia-off'] as const;

export const esClaveAislada = (k: unknown) => typeof k === 'string' && (CLAVES_AISLADAS as readonly string[]).includes(k);

/** Un almacén en memoria con la misma forma que Storage (getItem/setItem/removeItem). */
export function crearMemoria() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: unknown) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
    get size() { return m.size; },
  };
}
export type Memoria = ReturnType<typeof crearMemoria>;
