// Des-merge líquido: la tarjeta del producto se estira, suelta una gota que cae con un
// cuello líquido (filtro SVG #goo-hoja) hasta la base de la pantalla y, desde ahí, el
// líquido se derrama hacia arriba hasta formar la hoja de detalle (como la isla).
// Al cerrar, la hoja escurre a una gota que sube y se funde otra vez con la tarjeta.
// La foto del platillo viaja aparte, encima y nítida.

export type Caja = { x: number; y: number; w: number; h: number };
export const cajaDe = (el: Element): Caja => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

const css = (c: Caja, radio: string, extra: Keyframe = {}): Keyframe => ({ left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px`, borderRadius: radio, ...extra });
const SUAVE = 'cubic-bezier(0.45, 0, 0.55, 1)';
const CAE = 'cubic-bezier(0.55, 0, 0.85, 0.45)';
const DERRAMA = 'cubic-bezier(0.2, 0.9, 0.25, 1)';
export const RADIO_HOJA = '28px 28px 0px 0px';

/** Rectángulo visible de una imagen con object-fit: contain dentro de su caja. */
export function contenido(img: HTMLImageElement, caja = cajaDe(img)): Caja {
  const nw = img.naturalWidth || caja.w, nh = img.naturalHeight || caja.h;
  const s = Math.min(caja.w / nw, caja.h / nh);
  const w = nw * s, h = nh * s;
  return { x: caja.x + (caja.w - w) / 2, y: caja.y + (caja.h - h) / 2, w, h };
}

/** Geometría compartida por la ida y la vuelta. */
function trayecto(o: Caja) {
  const s = Math.max(56, Math.min(110, Math.min(o.w, o.h) * 0.55));
  const cx = o.x + o.w / 2;
  const abajo = o.y + o.h;
  // La gota cae recta bajo la tarjeta: así el cuello líquido se estira y se rompe a la vista.
  const yCaida = Math.min(abajo + s * 0.7, innerHeight - s - 18);
  const caida: Caja = { x: cx - s / 2, y: yCaida, w: s, h: s * 1.06 };
  const estira: Caja = { x: o.x + o.w * 0.1, y: o.y + o.h * 0.06, w: o.w * 0.8, h: o.h * 1.04 };
  const encoge: Caja = { x: o.x + o.w * 0.07, y: o.y + o.h * 0.07, w: o.w * 0.86, h: o.h * 0.86 };
  const g = Math.max(16, s * 0.3);
  const hilo = {
    dentro: { x: cx - g / 2, y: o.y + o.h / 2, w: g, h: g },
    borde: { x: cx - g / 2, y: abajo - g * 0.8, w: g, h: g * 1.6 },
    medio: { x: cx - g / 2, y: abajo + (yCaida - abajo) / 2 - g * 0.6, w: g * 0.85, h: g * 1.7 },
    llega: { x: cx - g / 2, y: yCaida + s * 0.15, w: g, h: g },
  };
  return { s, caida, estira, encoge, hilo };
}

export function crearLiquido() {
  const velo = document.getElementById('velo-hoja')!;
  const capa = document.createElement('div');
  capa.className = 'liquido';
  capa.setAttribute('aria-hidden', 'true');
  const madre = document.createElement('i');
  const hilo = document.createElement('i');
  const gota = document.createElement('i');
  capa.append(madre, hilo, gota);
  let vuelo: HTMLImageElement | null = null;

  const preparar = () => {
    [madre, hilo, gota, capa].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
    document.body.append(capa);
  };
  function limpiar() { capa.remove(); vuelo?.remove(); vuelo = null; }
  function veloSin(on: boolean) {
    velo.style.transition = 'none';
    velo.classList.toggle('on', on);
    void velo.offsetWidth;
    velo.style.transition = '';
  }

  /** Abrir: la gota se separa de la tarjeta, cae y se derrama hacia arriba en la hoja. */
  async function separar(o: Caja, radio: number, d: Caja, dur = 980) {
    preparar();
    velo.classList.add('on');
    const ro = `${radio}px`;
    const t = trayecto(o);
    const op = { duration: dur, easing: 'linear', fill: 'forwards' as const };
    const a = gota.animate([
      css(o, ro, { easing: SUAVE }),
      css(t.estira, ro, { offset: 0.16, easing: CAE }),
      css(t.caida, '50%', { offset: 0.46, easing: DERRAMA }),
      css(d, RADIO_HOJA),
    ], op);
    const b = madre.animate([
      css(o, ro, { opacity: 1, easing: SUAVE }),
      css(t.encoge, ro, { opacity: 1, offset: 0.2, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' }),
      css(o, ro, { opacity: 1, offset: 0.5 }),
      css(o, ro, { opacity: 1, offset: 0.82 }),
      css(t.encoge, ro, { opacity: 0 }),
    ], op);
    const c = hilo.animate([
      css(t.hilo.dentro, '50%'),
      css(t.hilo.borde, '50%', { offset: 0.18, easing: CAE }),
      css(t.hilo.medio, '50%', { offset: 0.4 }),
      css(t.hilo.llega, '50%', { offset: 0.56 }),
      css(t.hilo.llega, '50%', { offset: 0.7 }),
      css({ ...t.hilo.llega, y: d.y + 40 }, '50%'),
    ], op);
    await Promise.all([a.finished, b.finished, c.finished]);
  }

  /** Cerrar: la hoja escurre a una gota que sube y se funde con la tarjeta. */
  async function fundir(d: Caja, o: Caja, radio: number, dur = 900) {
    preparar();
    veloSin(true);
    requestAnimationFrame(() => velo.classList.remove('on'));
    const ro = `${radio}px`;
    const t = trayecto(o);
    const punto: Caja = { x: o.x + o.w / 2 - 8, y: o.y + o.h / 2 - 8, w: 16, h: 16 };
    const op = { duration: dur, easing: 'linear', fill: 'forwards' as const };
    const a = gota.animate([
      css(d, RADIO_HOJA, { easing: 'cubic-bezier(0.6, 0, 0.4, 1)' }),
      css(t.caida, '50%', { offset: 0.42, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)' }),
      css(t.estira, ro, { offset: 0.82, easing: SUAVE }),
      css(o, ro),
    ], op);
    const b = madre.animate([
      css(punto, '50%', { opacity: 0 }),
      css(punto, '50%', { opacity: 0, offset: 0.45 }),
      css(t.encoge, ro, { opacity: 1, offset: 0.75, easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)' }),
      css(o, ro, { opacity: 1 }),
    ], op);
    const c = hilo.animate([
      css({ ...t.hilo.llega, y: d.y + 40 }, '50%'),
      css(t.hilo.llega, '50%', { offset: 0.42 }),
      css(t.hilo.medio, '50%', { offset: 0.6 }),
      css(t.hilo.borde, '50%', { offset: 0.8 }),
      css(t.hilo.dentro, '50%'),
    ], op);
    await Promise.all([a.finished, b.finished, c.finished]);
    await capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished;
  }

  /** La foto del platillo viaja aparte. `espera`: fracción en que se queda quieta al inicio. */
  function volar(src: string, ajuste: 'contain' | 'cover', desde: Caja, hasta: Caja, radios: [string, string], dur = 980, espera = 0.12) {
    vuelo?.remove();
    vuelo = document.createElement('img');
    vuelo.src = src;
    vuelo.alt = '';
    vuelo.className = 'vuelo';
    vuelo.style.objectFit = ajuste;
    document.body.append(vuelo);
    return vuelo.animate(
      [css(desde, radios[0]), css(desde, radios[0], { offset: espera, easing: 'cubic-bezier(0.5, 0, 0.1, 1)' }), css(hasta, radios[1])],
      { duration: dur, easing: 'linear', fill: 'forwards' },
    ).finished;
  }

  return { separar, fundir, volar, limpiar, veloSin, RADIO_HOJA };
}
