// Selector de hora para recoger HOY: "Lo antes posible" primero y una cinta con
// las ranuras de 15 min agrupadas por hora (scroll-snap). Radios reales: flechas del
// teclado, lector de pantalla y foco funcionan sin trucos.
import { h12, minutos, type Ahora, type Txt } from '../../lib/horario';
import { ponerBi, reducir } from '../comun';

const reloj = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`; };
const sufijo = (t: string) => (Number(t.slice(0, 2)) < 12 ? 'am' : 'pm');

function radio(valor: string, checked: boolean, disabled = false) {
  const i = document.createElement('input');
  i.type = 'radio'; i.name = 'hora'; i.value = valor; i.className = 'sr-only';
  i.checked = checked; i.disabled = disabled;
  return i;
}

/** "en 1 h 5 min" / "in 1 h 5 min" */
export function falta(min: number): Txt {
  if (min < 60) return { es: `en ${min} min`, en: `in ${min} min` };
  const h = Math.floor(min / 60); const m = min % 60;
  return { es: `en ${h} h${m ? ` ${m} min` : ''}`, en: `in ${h} h${m ? ` ${m} min` : ''}` };
}

export function pintarHoras(o: {
  cont: HTMLElement; lectura: HTMLElement; ranuras: string[]; actual: string; ahora: Ahora;
  /** Hora elegida que ya venció: se muestra deshabilitada para explicar el error. */
  vencida: string | null;
  /** Texto del estado si hoy ya no hay horarios. */
  sinHoras: Txt | null;
}) {
  const { cont, ranuras, actual } = o;
  const frag = document.createDocumentFragment();

  const pronto = document.createElement('label');
  pronto.className = 'pd-hora-pronto presionable';
  const pt = document.createElement('span'); pt.className = 'pd-hora-pronto-t'; ponerBi(pt, 'Lo antes posible', 'As soon as possible');
  const ps = document.createElement('span'); ps.className = 'pd-hora-pronto-s'; ponerBi(ps, 'Listo en unos 25 min', 'Ready in about 25 min');
  const rayo = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  rayo.setAttribute('viewBox', '0 0 24 24'); rayo.setAttribute('width', '22'); rayo.setAttribute('height', '22'); rayo.setAttribute('aria-hidden', 'true');
  rayo.innerHTML = '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v4l2.5 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';
  const textos = document.createElement('span'); textos.className = 'grid'; textos.append(pt, ps);
  pronto.append(radio('pronto', actual === 'pronto'), rayo, textos);
  frag.append(pronto);

  if (o.sinHoras) {
    const p = document.createElement('p');
    p.className = 'pd-sin-horas';
    ponerBi(p, `Hoy ya no hay horarios para recoger (${o.sinHoras.es.toLowerCase()}). Elige «Lo antes posible» y el restaurante te confirma por WhatsApp.`,
      `There are no pickup times left today (${o.sinHoras.en.toLowerCase()}). Choose “As soon as possible” and the restaurant will confirm on WhatsApp.`);
    frag.append(p);
  }

  if (ranuras.length || o.vencida) {
    const envoltura = document.createElement('div');
    envoltura.className = 'pd-cinta-marco';
    const cinta = document.createElement('div');
    cinta.className = 'pd-cinta';
    const grupos = new Map<string, string[]>();
    for (const r of ranuras) { const h = r.slice(0, 2); grupos.set(h, [...(grupos.get(h) ?? []), r]); }
    for (const [h, lista] of grupos) {
      const g = document.createElement('div');
      g.className = 'pd-hora-grupo';
      const t = document.createElement('p'); t.className = 'pd-hora-h'; t.setAttribute('aria-hidden', 'true'); t.textContent = h12(`${h}:00`);
      g.append(t);
      for (const r of lista) {
        const l = document.createElement('label');
        l.className = 'pd-hora-chip presionable';
        const v = document.createElement('span'); v.textContent = reloj(r); v.setAttribute('aria-hidden', 'true');
        const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = `${reloj(r)} ${sufijo(r)}`;
        l.append(radio(r, actual === r), v, sr);
        g.append(l);
      }
      cinta.append(g);
    }
    if (o.vencida) {
      const g = document.createElement('div');
      g.className = 'pd-hora-grupo';
      const l = document.createElement('label');
      l.className = 'pd-hora-chip vencida';
      const v = document.createElement('span'); v.textContent = h12(o.vencida, true);
      const s = document.createElement('small'); ponerBi(s, 'ya no disponible', 'no longer available');
      l.append(radio(o.vencida, true, true), v, s);
      g.append(l);
      cinta.prepend(g);
    }
    const flecha = (dir: -1 | 1) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pd-cinta-flecha presionable ${dir < 0 ? 'izq' : 'der'}`;
      b.setAttribute('aria-label', dir < 0 ? 'Horas anteriores / Earlier times' : 'Horas siguientes / Later times');
      b.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${dir < 0 ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6'}"/></svg>`;
      b.addEventListener('click', () => cinta.scrollBy({ left: dir * cinta.clientWidth * 0.8, behavior: reducir() ? 'auto' : 'smooth' }));
      return b;
    };
    envoltura.append(flecha(-1), cinta, flecha(1));
    frag.append(envoltura);
  }
  cont.replaceChildren(frag);
  lectura(o);
  centrarElegida(cont);
}

/** Texto grande de la hora elegida ("Pasas a las 7:30 pm · en 1 h 5 min"). */
export function lectura(o: { lectura: HTMLElement; actual: string; ahora: Ahora; ranuras: string[] }) {
  const { actual } = o;
  const fuerte = document.createElement('strong');
  const suave = document.createElement('span');
  if (actual === 'pronto' || !o.ranuras.includes(actual)) {
    ponerBi(fuerte, 'Lo antes posible', 'As soon as possible');
    ponerBi(suave, ' · te avisamos por WhatsApp', ' · we’ll message you on WhatsApp');
  } else {
    ponerBi(fuerte, `Pasas a las ${h12(actual, true)}`, `Pickup at ${h12(actual, true)}`);
    const f = falta(Math.max(0, minutos(actual) - o.ahora.min));
    ponerBi(suave, ` · ${f.es}`, ` · ${f.en}`);
  }
  o.lectura.replaceChildren(fuerte, suave);
}

/** Lleva la ranura elegida al centro de la cinta sin mover la página. */
export function centrarElegida(cont: HTMLElement) {
  const cinta = cont.querySelector<HTMLElement>('.pd-cinta');
  const sel = cinta?.querySelector<HTMLElement>('input:checked')?.closest<HTMLElement>('label');
  if (!cinta || !sel) return;
  // .pd-cinta es position: relative, así que offsetLeft ya es relativo a la cinta.
  const destino = sel.offsetLeft - cinta.clientWidth / 2 + sel.offsetWidth / 2;
  cinta.scrollTo({ left: Math.max(0, destino) });
}
