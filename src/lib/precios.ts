// Precios: MXN con IVA incluido es el precio de cobro; USD solo es referencia.

const mxn = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** "$1,100" como en la cartilla (MXN con IVA incluido). */
export const precio = (n: number) => `$${mxn.format(n)}`;

/** Dólares aproximados, mínimo 1. */
export const dolares = (n: number, tc: number) => Math.max(1, Math.round(n / tc));

/** "≈ US$11": solo referencia, nunca precio de cobro. */
export const usd = (n: number, tc: number) => `≈ US$${dolares(n, tc)}`;
