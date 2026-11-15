// Plano de mesas (ilustrativo, por confirmar con el restaurante). Lógica pura.
// Los datos viven en src/data/mesas.json y se validan con zod en src/data/schema.ts.

export type MesaPlano = { n: number; x: number; y: number; forma: 'redonda' | 'cuadrada' | 'larga'; personas: number; rot?: number; zona: { es: string; en: string } };
export type PlanoMesas = { ancho: number; alto: number; mesas: MesaPlano[]; ocupadasDemo: number[] };

/** Número de mesa aceptable aunque no esté en el plano (los QR van de 1 a 99). */
export const mesaValida = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 99;

export const mesaDePlano = (p: PlanoMesas, n: number) => p.mesas.find((m) => m.n === n);

/** 'libre', 'ocupada' (disponibilidad de demostración) o 'fuera' (no aparece en el plano). */
export function estadoMesa(p: PlanoMesas, n: number): 'libre' | 'ocupada' | 'fuera' {
  if (!mesaDePlano(p, n)) return 'fuera';
  return p.ocupadasDemo.includes(n) ? 'ocupada' : 'libre';
}

/**
 * ¿Se puede elegir esta mesa? En el plano solo las libres. Una mesa que llega por el QR
 * se acepta siempre (el cliente ya está sentado ahí), aunque no esté dibujada u ocupada.
 */
export function puedeElegir(p: PlanoMesas, n: number, deQR = false): boolean {
  if (!mesaValida(n)) return false;
  if (deQR) return true;
  const e = estadoMesa(p, n);
  return e === 'libre' || e === 'fuera';
}

/** Posición relativa (0–100 %) del centro de la mesa, para colocar su botón sobre el dibujo. */
export const posicion = (p: PlanoMesas, m: MesaPlano) => ({ left: (m.x / p.ancho) * 100, top: (m.y / p.alto) * 100 });
