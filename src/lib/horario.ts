// Horario del local en hora de Sonora (America/Hermosillo, sin horario de verano).
// Lógica pura: se usa en el servidor (Astro) y en el navegador, y se prueba con vitest.

export type Horario = { dia: number; abre: string; cierra: string };
export type Ahora = { dia: number; min: number };
export type Txt = { es: string; en: string };

export const ZONA = 'America/Hermosillo';

export const DIAS: Txt[] = [
  { es: 'Domingo', en: 'Sunday' }, { es: 'Lunes', en: 'Monday' }, { es: 'Martes', en: 'Tuesday' },
  { es: 'Miércoles', en: 'Wednesday' }, { es: 'Jueves', en: 'Thursday' }, { es: 'Viernes', en: 'Friday' }, { es: 'Sábado', en: 'Saturday' },
];

/** "13:30" → 810 */
export const minutos = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m; };

/** "13:00" → "1 pm" (corto) o "1:00 pm" (completo). */
export function h12(t: string, completo = false) {
  const [h = 0, m = 0] = t.split(':').map(Number);
  const min = completo || m ? `:${String(m).padStart(2, '0')}` : '';
  return `${((h + 11) % 12) + 1}${min} ${h < 12 ? 'am' : 'pm'}`;
}

/** 810 → "13:30" */
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** Día de la semana (0 = domingo) y minuto del día en la zona del local. */
export function ahoraEn(fecha = new Date(), zona = ZONA): Ahora {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zona, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(fecha);
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? '';
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday')), min: (Number(v('hour')) % 24) * 60 + Number(v('minute')) };
}

export type Estado = { abierto: boolean; texto: Txt; hoy: Horario | undefined };

/** "Abierto ahora · cierra 9 pm", "Cerrado · abre hoy 1 pm" o "Cerrado · abre el miércoles 1 pm". */
export function estadoLocal(horario: Horario[], ahora: Ahora): Estado {
  const hoy = horario.find((h) => h.dia === ahora.dia);
  if (hoy && ahora.min >= minutos(hoy.abre) && ahora.min < minutos(hoy.cierra)) {
    return { abierto: true, hoy, texto: { es: `Abierto ahora · cierra ${h12(hoy.cierra)}`, en: `Open now · closes ${h12(hoy.cierra)}` } };
  }
  if (hoy && ahora.min < minutos(hoy.abre)) {
    return { abierto: false, hoy, texto: { es: `Cerrado · abre hoy ${h12(hoy.abre)}`, en: `Closed · opens today ${h12(hoy.abre)}` } };
  }
  for (let i = 1; i <= 7; i++) {
    const d = (ahora.dia + i) % 7;
    const h = horario.find((x) => x.dia === d);
    if (!h) continue;
    const cuando = i === 1 ? { es: 'mañana', en: 'tomorrow' } : { es: `el ${DIAS[d]!.es.toLowerCase()}`, en: DIAS[d]!.en };
    return { abierto: false, hoy, texto: { es: `Cerrado · abre ${cuando.es} ${h12(h.abre)}`, en: `Closed · opens ${cuando.en} ${h12(h.abre)}` } };
  }
  return { abierto: false, hoy, texto: { es: 'Cerrado', en: 'Closed' } };
}

/**
 * Horas para recoger hoy, cada `paso` minutos: desde dentro de `margen` minutos
 * (o desde que abre) hasta 15 min antes de cerrar. Vacío si hoy ya no hay servicio.
 */
export function ranurasHoy(horario: Horario[], ahora: Ahora, paso = 15, margen = 20): string[] {
  const hoy = horario.find((h) => h.dia === ahora.dia);
  if (!hoy) return [];
  const desde = Math.max(minutos(hoy.abre), Math.ceil((ahora.min + margen) / paso) * paso);
  const hasta = minutos(hoy.cierra) - 15;
  const out: string[] = [];
  for (let m = desde; m <= hasta; m += paso) out.push(hhmm(m));
  return out;
}

/** Reloj ensō de la portada: arco del servicio de hoy en una carátula de 12 h (como un reloj
 *  real: 1 pm queda en la 1 y 10 pm en las 10), dónde va la aguja ahora y cuánto falta. */
export type Reloj = {
  /** Grados (0 = las 12, sentido horario) donde empieza y termina el servicio de hoy; null si hoy cierra. */
  arco: { inicio: number; largo: number } | null;
  aguja: number;
  abierto: boolean;
  texto: Txt;
};
const grados = (min: number) => ((((min % 720) + 720) % 720) / 720) * 360;
const duracion = (m: number, en: boolean) => {
  const h = Math.floor(m / 60), r = m % 60;
  if (h === 0) return en ? `${r} min` : `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
};
export function relojHoy(horario: Horario[], ahora: Ahora): Reloj {
  const hoy = horario.find((h) => h.dia === ahora.dia);
  const aguja = grados(ahora.min);
  if (!hoy) {
    const e = estadoLocal(horario, ahora);
    return { arco: null, aguja, abierto: false, texto: e.texto };
  }
  const a = minutos(hoy.abre), c = minutos(hoy.cierra);
  const arco = { inicio: grados(a), largo: Math.min(360, ((c - a) / 720) * 360) };
  if (ahora.min >= a && ahora.min < c) {
    const falta = c - ahora.min;
    return { arco, aguja, abierto: true, texto: { es: `Cierra en ${duracion(falta, false)}`, en: `Closes in ${duracion(falta, true)}` } };
  }
  if (ahora.min < a) {
    const falta = a - ahora.min;
    return { arco, aguja, abierto: false, texto: { es: `Abre en ${duracion(falta, false)}`, en: `Opens in ${duracion(falta, true)}` } };
  }
  return { arco, aguja, abierto: false, texto: estadoLocal(horario, ahora).texto };
}
