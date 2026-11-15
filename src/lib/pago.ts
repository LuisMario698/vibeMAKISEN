// Pago del pedido: efectivo o tarjeta, siempre al recibir (nunca en línea).
// Lógica pura: se prueba con vitest y la usan src/lib/pedido.ts y la interfaz.

import { precio } from './precios';

export type FormaPago = '' | 'efectivo' | 'tarjeta';
/** Con cuánto paga en efectivo: 'exacto', un monto en MXN o null (no lo dijo). */
export type Paga = 'exacto' | number | null;
type ModoPago = 'mesa' | 'llevar' | 'domicilio';

/** Tope razonable para un billete o suma de billetes (evita números absurdos en el mensaje). */
export const PAGA_MAXIMA = 20000;

/** Monto válido: entero positivo dentro del tope. */
export const montoValido = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= PAGA_MAXIMA;

/** Lo guardado o escrito, convertido a un Paga válido (lo demás se ignora). */
export function sanearPaga(v: unknown): Paga {
  if (v === 'exacto') return 'exacto';
  return montoValido(v) ? v : null;
}

/** El monto alcanza para el total (o es exacto, o no se dijo). */
export const pagaCubre = (paga: Paga, total: number) => paga === null || paga === 'exacto' || paga >= total;

/** Cambio a entregar; 0 si es exacto, no se dijo o no alcanza. */
export const cambio = (paga: Paga, total: number) => (typeof paga === 'number' && paga > total ? paga - total : 0);

/**
 * Montos redondos mayores al total para "¿Con cuánto pagas?": la siguiente centena,
 * el siguiente múltiplo de 200 y de 500, y billetes de $500/$1,000. Hasta `cuantos`, sin repetir.
 */
export function montosSugeridos(total: number, cuantos = 3): number[] {
  if (!(total > 0)) return [];
  const arriba = (m: number) => (total % m === 0 ? total + m : Math.ceil(total / m) * m);
  const candidatos = [arriba(100), arriba(200), arriba(500), arriba(500) + 500, arriba(1000), 500, 1000, 2000];
  const out: number[] = [];
  for (const c of candidatos.sort((a, b) => a - b)) {
    if (c > total && c <= PAGA_MAXIMA && !out.includes(c)) out.push(c);
    if (out.length === cuantos) break;
  }
  return out;
}

const DONDE = {
  es: { mesa: 'terminal en la mesa', llevar: 'terminal en caja', domicilio: 'terminal al recibir' },
  en: { mesa: 'card terminal at the table', llevar: 'card terminal at the counter', domicilio: 'card terminal on delivery' },
} as const;

/** Dónde se cobra con tarjeta, según la modalidad (para la interfaz y el mensaje). */
export const dondeTerminal = (modo: ModoPago, idioma: 'es' | 'en') => DONDE[idioma][modo];

/** Línea del mensaje de WhatsApp sobre el pago. Vacía si aún no eligió forma de pago. */
export function lineaPago(forma: FormaPago, paga: Paga, modo: ModoPago, total: number, idioma: 'es' | 'en'): string {
  const es = idioma === 'es';
  if (forma === 'tarjeta') return `${es ? 'Pago: tarjeta' : 'Payment: card'} (${dondeTerminal(modo, idioma)})`;
  if (forma !== 'efectivo') return '';
  const base = es ? 'Pago: efectivo' : 'Payment: cash';
  if (paga === 'exacto') return `${base} (${es ? 'exacto' : 'exact amount'})`;
  if (typeof paga === 'number' && paga >= total) {
    const c = cambio(paga, total);
    const rotulo = modo === 'domicilio' ? (es ? 'cambio antes del envío' : 'change before delivery fee') : (es ? 'cambio' : 'change');
    return `${base}, ${es ? 'paga con' : 'paying with'} ${precio(paga)}${c ? ` (${rotulo}: ${precio(c)})` : ''}`;
  }
  return base;
}
