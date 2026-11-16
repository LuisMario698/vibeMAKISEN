// Hora para recoger HOY: un <select> nativo con "Lo antes posible" y las ranuras de 15 min
// agrupadas por hora (optgroup). En el teléfono abre la rueda del sistema: cabe en un renglón
// de la comanda y funciona con teclado y lector de pantalla sin trucos.
import { h12, minutos, type Ahora, type Txt } from '../../lib/horario';
import { idioma, ponerBi } from '../comun';

/** "en 1 h 5 min" / "in 1 h 5 min" */
export function falta(min: number): Txt {
  if (min < 60) return { es: `en ${min} min`, en: `in ${min} min` };
  const h = Math.floor(min / 60); const m = min % 60;
  return { es: `en ${h} h${m ? ` ${m} min` : ''}`, en: `in ${h} h${m ? ` ${m} min` : ''}` };
}

function opcion(valor: string, texto: string, sel: boolean, deshabilitada = false) {
  const o = document.createElement('option');
  o.value = valor; o.textContent = texto; o.selected = sel; o.disabled = deshabilitada;
  return o;
}

export function pintarHoras(o: {
  cont: HTMLSelectElement; lectura: HTMLElement; ranuras: string[]; actual: string; ahora: Ahora;
  /** Hora elegida que ya venció: se muestra deshabilitada para explicar el error. */
  vencida: string | null;
  /** Texto del estado si hoy ya no hay horarios. */
  sinHoras: Txt | null;
}) {
  const en = idioma() === 'en';
  const frag = document.createDocumentFragment();
  if (o.vencida) frag.append(opcion(o.vencida, `${h12(o.vencida, true)} · ${en ? 'no longer available' : 'ya no disponible'}`, true, true));
  frag.append(opcion('pronto', en ? 'As soon as possible' : 'Lo antes posible', o.actual === 'pronto' && !o.vencida));
  const grupos = new Map<string, string[]>();
  for (const r of o.ranuras) { const h = r.slice(0, 2); grupos.set(h, [...(grupos.get(h) ?? []), r]); }
  for (const [h, lista] of grupos) {
    const g = document.createElement('optgroup');
    g.label = h12(`${h}:00`);
    for (const r of lista) g.append(opcion(r, h12(r, true), o.actual === r && !o.vencida));
    frag.append(g);
  }
  o.cont.replaceChildren(frag);
  lectura(o);
}

/** Lectura bajo el renglón: "Hoy · en 1 h 5 min" o, si ya no hay horas, por qué. */
export function lectura(o: { lectura: HTMLElement; actual: string; ahora: Ahora; ranuras: string[]; sinHoras?: Txt | null }) {
  if (o.sinHoras) {
    ponerBi(o.lectura, 'Ya no hay horas para hoy; el restaurante te confirma por WhatsApp.', 'No pickup times left today; the restaurant will confirm on WhatsApp.');
    return;
  }
  if (o.actual === 'pronto' || !o.ranuras.includes(o.actual)) {
    ponerBi(o.lectura, 'Hoy, listo en unos 25 min.', 'Today, ready in about 25 min.');
    return;
  }
  const f = falta(Math.max(0, minutos(o.actual) - o.ahora.min));
  ponerBi(o.lectura, `Hoy a las ${h12(o.actual, true)}, ${f.es}.`, `Today at ${h12(o.actual, true)}, ${f.en}.`);
}
