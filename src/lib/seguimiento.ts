// Folio del pedido y seguimiento estimado después de mandarlo por WhatsApp.
// Lógica pura (sin DOM): se prueba con vitest. El estado real lo confirma el
// restaurante por WhatsApp; aquí solo hay tiempos ESTIMADOS.

import type { Txt } from './horario';
import type { FormaPago, Paga } from './pago';
import { sanearPaga } from './pago';

type Modo = 'mesa' | 'llevar' | 'domicilio';

/* ── Folio ──────────────────────────────────────────────────────────── */

/** Sin caracteres que se confunden al dictarlos o leerlos: 0/O, 1/I/L. */
export const ALFABETO_FOLIO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const RE_FOLIO = new RegExp(`^MZ-[${ALFABETO_FOLIO}]{4}$`);

export const esFolio = (s: unknown): s is string => typeof s === 'string' && RE_FOLIO.test(s);

/** "MZ-4F7K". `azar` devuelve [0, 1); en el navegador se le pasa crypto.getRandomValues. */
export function crearFolio(azar: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < 4; i++) s += ALFABETO_FOLIO[Math.min(ALFABETO_FOLIO.length - 1, Math.floor(azar() * ALFABETO_FOLIO.length))];
  return `MZ-${s}`;
}

/* ── Etapas estimadas ───────────────────────────────────────────────── */

export type IdEtapa = 'enviado' | 'confirmacion' | 'preparacion' | 'servido' | 'listo' | 'camino';
export type Etapa = { id: IdEtapa; ms: number; estimado: boolean; titulo: Txt; detalle: Txt };

const MIN = 60_000;
/** Minutos después de enviar (estimados para la demo, por ajustar con el restaurante). */
export const TIEMPOS = { confirmacion: 3, preparacion: 8, final: { mesa: 22, llevar: 25, domicilio: 40 } } as const;

const FINAL: Record<Modo, { id: IdEtapa; titulo: Txt; detalle: Txt }> = {
  mesa: { id: 'servido', titulo: { es: 'Servido en tu mesa', en: 'Served at your table' }, detalle: { es: 'Te lo llevamos a la mesa.', en: 'We bring it to your table.' } },
  llevar: { id: 'listo', titulo: { es: 'Listo para recoger', en: 'Ready for pickup' }, detalle: { es: 'Pasa a caja con tu folio.', en: 'Show your order number at the counter.' } },
  domicilio: { id: 'camino', titulo: { es: 'En camino', en: 'On the way' }, detalle: { es: 'El repartidor va hacia tu ubicación.', en: 'The driver is heading to you.' } },
};

/**
 * Línea de tiempo con tiempos estimados y la etapa en la que "probablemente" va.
 * `listoMs` (para llevar a una hora elegida) retrasa la última etapa a esa hora.
 */
export function etapaEstimada(modo: Modo, enviadoMs: number, ahoraMs: number, listoMs?: number): { etapas: Etapa[]; actual: number } {
  let final = enviadoMs + TIEMPOS.final[modo] * MIN;
  if (modo === 'llevar' && typeof listoMs === 'number' && listoMs > final) final = listoMs;
  const f = FINAL[modo];
  const etapas: Etapa[] = [
    { id: 'enviado', ms: enviadoMs, estimado: false, titulo: { es: 'Enviado por WhatsApp', en: 'Sent on WhatsApp' }, detalle: { es: 'Tu comanda salió de este teléfono.', en: 'Your order left this phone.' } },
    { id: 'confirmacion', ms: enviadoMs + TIEMPOS.confirmacion * MIN, estimado: true, titulo: { es: 'Confirmación del restaurante', en: 'Restaurant confirms' }, detalle: { es: 'Te responden por WhatsApp.', en: 'They reply on WhatsApp.' } },
    { id: 'preparacion', ms: enviadoMs + TIEMPOS.preparacion * MIN, estimado: true, titulo: { es: 'En preparación', en: 'Being prepared' }, detalle: { es: 'La cocina arma tu pedido.', en: 'The kitchen is making it.' } },
    { id: f.id, ms: final, estimado: true, titulo: f.titulo, detalle: f.detalle },
  ];
  let actual = 0;
  etapas.forEach((e, i) => { if (ahoraMs >= e.ms) actual = i; });
  return { etapas, actual };
}

/* ── Pedido enviado (localStorage "makizen-pedido") ─────────────────── */

export type LineaEnviada = { n: number; nombre: Txt; op?: Txt; nota?: string };
export type PedidoEnviado = {
  v: 1;
  /** Hora de envío (ms). */
  t: number;
  folio: string;
  modo: Modo;
  lineas: LineaEnviada[];
  total: number;
  mesa: number | null;
  /** 'pronto' o "HH:MM" (para llevar). */
  hora: string;
  /** Hora estimada de recoger (ms) si eligió una hora. */
  listo?: number;
  pago: FormaPago;
  paga: Paga;
  /** El mismo enlace wa.me que se abrió (para "Volver a enviar"). */
  url: string;
};

export const HORAS_PEDIDO = 12;

const txt = (v: unknown, max = 120): Txt | null => {
  const o = v as Partial<Txt> | null;
  if (!o || typeof o.es !== 'string' || typeof o.en !== 'string' || !o.es || !o.en) return null;
  return { es: o.es.slice(0, max), en: o.en.slice(0, max) };
};

/** Revisa lo guardado: null si está corrupto, es de otra versión, tiene más de 12 h o un enlace ajeno. */
export function sanearPedido(crudo: unknown, ahora: number): PedidoEnviado | null {
  const o = (crudo && typeof crudo === 'object' ? crudo : null) as Partial<PedidoEnviado> | null;
  if (!o || o.v !== 1 || typeof o.t !== 'number' || ahora - o.t > HORAS_PEDIDO * 3600_000 || o.t > ahora + 60_000) return null;
  if (!esFolio(o.folio) || !['mesa', 'llevar', 'domicilio'].includes(o.modo as string)) return null;
  if (typeof o.url !== 'string' || !o.url.startsWith('https://wa.me/') || o.url.length > 4000) return null;
  if (!Array.isArray(o.lineas)) return null;
  const lineas: LineaEnviada[] = [];
  for (const l of o.lineas.slice(0, 30) as Partial<LineaEnviada>[]) {
    const nombre = txt(l?.nombre);
    const n = Math.floor(Number(l?.n));
    if (!nombre || !(n >= 1 && n <= 20)) continue;
    const op = txt(l?.op) ?? undefined;
    const nota = typeof l?.nota === 'string' ? l.nota.slice(0, 80) : undefined;
    lineas.push({ n, nombre, ...(op ? { op } : {}), ...(nota ? { nota } : {}) });
  }
  if (lineas.length === 0) return null;
  const total = Number(o.total);
  const mesa = Number.isInteger(o.mesa) && o.mesa! >= 1 && o.mesa! <= 99 ? o.mesa! : null;
  const hora = o.hora === 'pronto' || (typeof o.hora === 'string' && /^\d{2}:\d{2}$/.test(o.hora)) ? o.hora : 'pronto';
  return {
    v: 1, t: o.t, folio: o.folio, modo: o.modo as Modo, lineas,
    total: Number.isFinite(total) && total >= 0 ? Math.round(total) : 0,
    mesa, hora,
    ...(typeof o.listo === 'number' && Number.isFinite(o.listo) ? { listo: o.listo } : {}),
    pago: o.pago === 'efectivo' || o.pago === 'tarjeta' ? o.pago : '',
    paga: sanearPaga(o.paga),
    url: o.url,
  };
}

/** Mensaje corto para preguntar por el pedido (el folio va primero para que lo encuentren rápido). */
export function textoPregunta(folio: string, idioma: 'es' | 'en'): string {
  return idioma === 'en'
    ? `Hi! I'm checking on my order ${folio} from the digital menu. How is it going?`
    : `¡Hola! Pregunto por mi pedido ${folio} del menú digital. ¿Cómo va?`;
}

/** Enlace wa.me para preguntar por el pedido. */
export const enlacePregunta = (numero: string, folio: string, idioma: 'es' | 'en') =>
  `https://wa.me/${numero}?text=${encodeURIComponent(textoPregunta(folio, idioma))}`;
