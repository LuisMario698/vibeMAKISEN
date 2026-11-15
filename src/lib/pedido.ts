// "Mi pedido" (antes "Mi lista") y comanda por WhatsApp. Lógica pura (sin DOM):
// se prueba con vitest y se usa desde src/scripts/lista.ts.

import { h12 } from './horario';
import { lineaPago, pagaCubre, sanearPaga, type FormaPago, type Paga } from './pago';
import { precio } from './precios';
import { esFolio } from './seguimiento';
import { enlaceUbicacion, sanearCoord, type Coordenada } from './ubicacion';

export type Txt = { es: string; en: string };
export type Idioma = 'es' | 'en';
export type Modo = 'mesa' | 'llevar' | 'domicilio';

/** Lo que el pedido necesita saber de cada platillo del menú vigente. */
export type ItemCatalogo = {
  nombre: Txt;
  precio: number;
  agotado: boolean;
  opciones?: { titulo: Txt; valores: { id: string; nombre: Txt }[] } | undefined;
};
export type Catalogo = Map<string, ItemCatalogo>;

/** Una línea de la lista. `p` es el precio con el que se agregó (para avisar si cambia). */
export type Linea = { id: string; op?: string; n: number; nota?: string; p: number };

export type Lista = {
  v: 1;
  /** Última modificación (ms). */
  t: number;
  lineas: Linea[];
  modo: Modo;
  nombre: string;
  /** 'pronto' o "HH:MM" */
  hora: string;
  direccion: string;
  referencias: string;
  /** Punto en el mapa para el repartidor (a domicilio), o null si no lo fijó. */
  ubic: Coordenada | null;
  /** '' mientras no elige; nunca hay pago en línea. */
  pago: FormaPago;
  /** Con cuánto paga en efectivo ('exacto', monto o null). */
  paga: Paga;
  /** Folio corto del pedido ("MZ-4F7K"); '' hasta que la interfaz lo crea. */
  folio: string;
};

/** Datos de entrega con la mesa (que vive aparte, en sessionStorage). */
export type Entrega = Pick<Lista, 'modo' | 'nombre' | 'hora' | 'direccion' | 'referencias'>
  & Partial<Pick<Lista, 'ubic' | 'pago' | 'paga' | 'folio'>>
  & { mesa: number | null };

export const LIMITES = { cantidad: 20, lineas: 30, nota: 80, nombre: 40, direccion: 160, referencias: 160, horas: 12 } as const;
export const VERSION = 1;

/** Recorta por caracteres reales (no parte emojis ni otros pares sustitutos). */
export const recortar = (s: string, max: number) => (s.length <= max ? s : Array.from(s).slice(0, max).join('').replace(/[\uD800-\uDBFF]$/, ''));

/** Quita caracteres de control, junta espacios y recorta. */
export const limpiar = (s: unknown, max: number) =>
  typeof s === 'string' ? recortar(s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim(), max).trim() : '';

export const listaVacia = (ahora: number, modo: Modo = 'llevar'): Lista => ({
  v: VERSION, t: ahora, lineas: [], modo, nombre: '', hora: 'pronto', direccion: '', referencias: '', ubic: null, pago: '', paga: null, folio: '',
});

export const clave = (l: Pick<Linea, 'id' | 'op' | 'nota'>) => `${l.id}|${l.op ?? ''}|${l.nota ?? ''}`;

export type ErrorAgregar = 'inexistente' | 'agotado' | 'opcion' | 'llena' | 'tope';

/**
 * Agrega (o suma a una línea igual). No muta la lista recibida.
 * `agregadas` es lo que de verdad se sumó (puede ser menos que lo pedido por el tope de 20).
 */
export function agregar(
  lista: Lista,
  item: { id: string; op?: string | undefined; n: number; nota?: string | undefined },
  catalogo: Catalogo,
  ahora: number,
): { lista: Lista; error?: ErrorAgregar; agregadas: number } {
  const c = catalogo.get(item.id);
  if (!c) return { lista, error: 'inexistente', agregadas: 0 };
  if (c.agotado) return { lista, error: 'agotado', agregadas: 0 };
  const op = c.opciones ? item.op : undefined;
  if (c.opciones && !c.opciones.valores.some((v) => v.id === op)) return { lista, error: 'opcion', agregadas: 0 };
  const nota = limpiar(item.nota, LIMITES.nota) || undefined;
  const n = Math.max(1, Math.min(LIMITES.cantidad, Math.floor(item.n) || 1));
  const nueva: Linea = { id: item.id, n, p: c.precio, ...(op ? { op } : {}), ...(nota ? { nota } : {}) };
  const k = clave(nueva);
  const i = lista.lineas.findIndex((l) => clave(l) === k);
  if (i >= 0) {
    const actual = lista.lineas[i]!.n;
    const agregadas = Math.min(LIMITES.cantidad, actual + n) - actual;
    if (agregadas === 0) return { lista, error: 'tope', agregadas: 0 };
    const lineas = lista.lineas.map((l, j) => (j === i ? { ...l, n: actual + agregadas, p: c.precio } : l));
    return { lista: { ...lista, lineas, t: ahora }, agregadas };
  }
  if (lista.lineas.length >= LIMITES.lineas) return { lista, error: 'llena', agregadas: 0 };
  return { lista: { ...lista, lineas: [...lista.lineas, nueva], t: ahora }, agregadas: n };
}

/**
 * Cambia la nota de una línea. Si queda igual a otra línea (mismo platillo, opción y nota),
 * se juntan respetando el tope por platillo. Devuelve el índice donde quedó.
 */
export function cambiarNota(lista: Lista, indice: number, nota: string, ahora: number): { lista: Lista; indice: number } {
  const l = lista.lineas[indice];
  if (!l) return { lista, indice };
  const limpia = limpiar(nota, LIMITES.nota) || undefined;
  const { nota: _vieja, ...resto } = l;
  const nueva: Linea = { ...resto, ...(limpia ? { nota: limpia } : {}) };
  const otra = lista.lineas.findIndex((x, j) => j !== indice && clave(x) === clave(nueva));
  if (otra < 0) return { lista: { ...lista, lineas: lista.lineas.map((x, j) => (j === indice ? nueva : x)), t: ahora }, indice };
  const juntas = lista.lineas
    .map((x, j) => (j === otra ? { ...x, n: Math.min(LIMITES.cantidad, x.n + l.n) } : x))
    .filter((_, j) => j !== indice);
  return { lista: { ...lista, lineas: juntas, t: ahora }, indice: otra > indice ? otra - 1 : otra };
}

/** Regresa una línea quitada a su lugar ("Deshacer"). Si ya existe igual, suma; respeta los topes. */
export function restaurar(lista: Lista, indice: number, linea: Linea, ahora: number): Lista {
  const i = lista.lineas.findIndex((x) => clave(x) === clave(linea));
  if (i >= 0) return { ...lista, lineas: lista.lineas.map((x, j) => (j === i ? { ...x, n: Math.min(LIMITES.cantidad, x.n + linea.n) } : x)), t: ahora };
  if (lista.lineas.length >= LIMITES.lineas) return lista;
  const lineas = [...lista.lineas];
  lineas.splice(Math.max(0, Math.min(indice, lineas.length)), 0, linea);
  return { ...lista, lineas, t: ahora };
}

/** Cambia la cantidad de una línea; 0 la quita. */
export function cambiar(lista: Lista, indice: number, n: number, ahora: number): Lista {
  if (!lista.lineas[indice]) return lista;
  const lineas = n <= 0
    ? lista.lineas.filter((_, j) => j !== indice)
    : lista.lineas.map((l, j) => (j === indice ? { ...l, n: Math.min(LIMITES.cantidad, Math.floor(n)) } : l));
  return { ...lista, lineas, t: ahora };
}

export type Aviso =
  | { tipo: 'quitado'; id: string }
  | { tipo: 'agotado'; id: string }
  | { tipo: 'precio'; id: string; antes: number; despues: number };

const MODOS: Modo[] = ['mesa', 'llevar', 'domicilio'];

/**
 * Revisa lo guardado contra el menú vigente. Lista vacía si viene corrupta, de otra
 * versión o con más de 12 h. Quita platillos que ya no existen u opciones inválidas,
 * marca agotados y actualiza precios, con avisos para la interfaz.
 */
export function sanear(crudo: unknown, catalogo: Catalogo, ahora: number): { lista: Lista; avisos: Aviso[] } {
  const avisos: Aviso[] = [];
  const o = (crudo && typeof crudo === 'object' ? crudo : null) as Partial<Lista> | null;
  if (!o || o.v !== VERSION || typeof o.t !== 'number' || ahora - o.t > LIMITES.horas * 3600_000 || o.t > ahora + 60_000 || !Array.isArray(o.lineas)) {
    return { lista: listaVacia(ahora), avisos };
  }
  const lineas: Linea[] = [];
  const vistos = new Set<string>();
  for (const l of o.lineas.slice(0, LIMITES.lineas) as Partial<Linea>[]) {
    if (!l || typeof l.id !== 'string') continue;
    const c = catalogo.get(l.id);
    if (!c) { avisos.push({ tipo: 'quitado', id: l.id }); continue; }
    const op = c.opciones ? l.op : undefined;
    if (c.opciones && !c.opciones.valores.some((v) => v.id === op)) { avisos.push({ tipo: 'quitado', id: l.id }); continue; }
    const n = Math.max(1, Math.min(LIMITES.cantidad, Math.floor(Number(l.n)) || 1));
    const nota = limpiar(l.nota, LIMITES.nota) || undefined;
    const linea: Linea = { id: l.id, n, p: c.precio, ...(op ? { op } : {}), ...(nota ? { nota } : {}) };
    if (vistos.has(clave(linea))) continue;
    vistos.add(clave(linea));
    if (c.agotado) avisos.push({ tipo: 'agotado', id: l.id });
    else if (typeof l.p === 'number' && l.p !== c.precio) avisos.push({ tipo: 'precio', id: l.id, antes: l.p, despues: c.precio });
    lineas.push(linea);
  }
  const modo = MODOS.includes(o.modo as Modo) ? (o.modo as Modo) : 'llevar';
  const hora = o.hora === 'pronto' || (typeof o.hora === 'string' && /^\d{2}:\d{2}$/.test(o.hora)) ? o.hora : 'pronto';
  return {
    lista: {
      v: VERSION, t: o.t, lineas, modo, hora,
      nombre: limpiar(o.nombre, LIMITES.nombre),
      direccion: limpiar(o.direccion, LIMITES.direccion),
      referencias: limpiar(o.referencias, LIMITES.referencias),
      ubic: sanearCoord(o.ubic),
      pago: o.pago === 'efectivo' || o.pago === 'tarjeta' ? o.pago : '',
      paga: sanearPaga(o.paga),
      folio: esFolio(o.folio) ? o.folio : '',
    },
    avisos,
  };
}

/** Líneas que sí entran al pedido (no agotadas). */
export const vigentes = (lista: Lista, catalogo: Catalogo) => lista.lineas.filter((l) => { const c = catalogo.get(l.id); return c && !c.agotado; });
export const subtotal = (lista: Lista, catalogo: Catalogo) => vigentes(lista, catalogo).reduce((s, l) => s + catalogo.get(l.id)!.precio * l.n, 0);
export const piezas = (lista: Lista, catalogo: Catalogo) => vigentes(lista, catalogo).reduce((s, l) => s + l.n, 0);

export type Campo = 'lista' | 'mesa' | 'nombre' | 'hora' | 'direccion' | 'pago' | 'paga';
export type Errores = Partial<Record<Campo, string>>;

export const MENSAJES_ERROR: Record<Campo, Txt> = {
  lista: { es: 'Agrega al menos un platillo disponible.', en: 'Add at least one available item.' },
  mesa: { es: 'Escribe el número de mesa (1 a 99).', en: 'Enter your table number (1 to 99).' },
  nombre: { es: 'Escribe tu nombre.', en: 'Enter your name.' },
  hora: { es: 'Elige a qué hora pasas (la que elegiste ya no está disponible).', en: 'Choose a pickup time (the one you picked is no longer available).' },
  direccion: { es: 'Escribe la dirección de entrega.', en: 'Enter the delivery address.' },
  pago: { es: 'Elige cómo vas a pagar: efectivo o tarjeta.', en: 'Choose how you will pay: cash or card.' },
  paga: { es: 'El monto con que pagas debe cubrir el total.', en: 'The cash amount must cover the total.' },
};

/** A qué paso del pedido pertenece cada error (para mostrarlo donde se corrige). */
export const PASO_DE: Record<Campo, 1 | 2 | 3> = { lista: 1, mesa: 2, nombre: 2, hora: 2, direccion: 2, pago: 3, paga: 3 };

/**
 * Qué falta para poder enviar, según la modalidad. `horasVigentes` (de ranurasHoy)
 * hace que una hora de recoger que ya pasó o cae después del cierre no sea válida.
 */
export function validar(lista: Lista, catalogo: Catalogo, e: Entrega, horasVigentes?: string[]): Errores {
  const err: Errores = {};
  if (vigentes(lista, catalogo).length === 0) err.lista = 'vacia';
  if (e.modo === 'mesa') {
    if (!(Number.isInteger(e.mesa) && e.mesa! >= 1 && e.mesa! <= 99)) err.mesa = 'requerida';
  } else {
    if (limpiar(e.nombre, LIMITES.nombre).length < 2) err.nombre = 'requerido';
    if (e.modo === 'llevar' && !(e.hora === 'pronto' || /^\d{2}:\d{2}$/.test(e.hora))) err.hora = 'requerida';
    else if (e.modo === 'llevar' && e.hora !== 'pronto' && horasVigentes && !horasVigentes.includes(e.hora)) err.hora = 'pasada';
    if (e.modo === 'domicilio' && limpiar(e.direccion, LIMITES.direccion).length < 8) err.direccion = 'requerida';
  }
  if (e.pago !== undefined) {
    if (e.pago !== 'efectivo' && e.pago !== 'tarjeta') err.pago = 'requerido';
    else if (e.pago === 'efectivo' && !pagaCubre(e.paga ?? null, subtotal(lista, catalogo))) err.paga = 'insuficiente';
  }
  return err;
}

const T = {
  es: {
    titulo: 'Pedido MAKIZEN', origen: '(menú digital)', mesa: 'En mesa', llevar: 'Para llevar', domicilio: 'A domicilio', pronto: 'lo antes posible',
    direccion: 'Dirección', referencias: 'Referencias', ubicacion: 'Ubicación', nota: 'Nota', subtotal: 'Subtotal', iva: 'MXN (IVA incluido)',
    final: 'Precio final lo confirma el restaurante.', envio: 'Envío: lo confirma el restaurante.',
  },
  en: {
    titulo: 'MAKIZEN order', origen: '(digital menu)', mesa: 'Dine-in, table', llevar: 'Pickup', domicilio: 'Delivery', pronto: 'as soon as possible',
    direccion: 'Address', referencias: 'Landmarks', ubicacion: 'Location', nota: 'Note', subtotal: 'Subtotal', iva: 'MXN (tax included)',
    final: 'Final price confirmed by the restaurant.', envio: 'Delivery fee: confirmed by the restaurant.',
  },
} as const;

/**
 * Texto del mensaje. Los rótulos van en el idioma del cliente, pero cada platillo
 * lleva su nombre en español porque es el que lee la cocina. Solo MXN.
 * `compacto` quita negritas y líneas en blanco y acorta las notas.
 */
export function armarMensaje(lista: Lista, catalogo: Catalogo, e: Entrega, idioma: Idioma, compacto = false): string {
  const t = T[idioma];
  const b = (s: string) => (compacto ? s : `*${s}*`);
  const out: string[] = [`${b(esFolio(e.folio) ? `${t.titulo} · ${e.folio}` : t.titulo)} ${t.origen}`];
  const nombre = limpiar(e.nombre, LIMITES.nombre);
  if (e.modo === 'mesa') out.push(`${t.mesa}: ${e.mesa}`);
  else if (e.modo === 'llevar') out.push(`${t.llevar}: ${nombre} - ${e.hora === 'pronto' ? t.pronto : h12(e.hora)}`);
  else {
    out.push(`${t.domicilio}: ${nombre}`);
    out.push(`${t.direccion}: ${limpiar(e.direccion, LIMITES.direccion)}`);
    const ref = limpiar(e.referencias, LIMITES.referencias);
    if (ref) out.push(`${t.referencias}: ${ref}`);
    const c = sanearCoord(e.ubic);
    if (c) out.push(`${t.ubicacion}: ${enlaceUbicacion(c)}`);
  }
  if (!compacto) out.push('');
  for (const l of vigentes(lista, catalogo)) {
    const c = catalogo.get(l.id)!;
    const op = l.op ? c.opciones?.valores.find((v) => v.id === l.op)?.nombre.es : undefined;
    out.push(`${l.n} x ${c.nombre.es}${op ? ` (${op})` : ''}  ${precio(c.precio * l.n)}`);
    if (l.nota) {
      const corta = compacto ? recortar(l.nota, 40) : l.nota;
      out.push(`   ${t.nota}: ${corta}${corta.length < l.nota.length ? '…' : ''}`);
    }
  }
  if (!compacto) out.push('');
  const total = subtotal(lista, catalogo);
  out.push(`${b(`${t.subtotal}: ${precio(total)}`)} ${t.iva}`);
  const pago = lineaPago(e.pago ?? '', e.paga ?? null, e.modo, total, idioma);
  if (pago) out.push(pago);
  if (e.modo === 'domicilio') out.push(t.envio);
  out.push(t.final);
  return out.join('\n');
}

export const LARGO = { compactar: 2000, maximo: 4000 } as const;

export type Enlace = { ok: true; url: string; compacto: boolean } | { ok: false; motivo: 'vacia' | 'larga' };

/** Enlace wa.me con el mensaje. Si es largo lo compacta; si aun así no cabe, lo rechaza. */
export function enlaceWhatsApp(numero: string, lista: Lista, catalogo: Catalogo, e: Entrega, idioma: Idioma): Enlace {
  if (vigentes(lista, catalogo).length === 0) return { ok: false, motivo: 'vacia' };
  const url = (compacto: boolean) => `https://wa.me/${numero}?text=${encodeURIComponent(armarMensaje(lista, catalogo, e, idioma, compacto))}`;
  const normal = url(false);
  if (normal.length <= LARGO.compactar) return { ok: true, url: normal, compacto: false };
  const corto = url(true);
  if (corto.length <= LARGO.maximo) return { ok: true, url: corto, compacto: true };
  return { ok: false, motivo: 'larga' };
}
