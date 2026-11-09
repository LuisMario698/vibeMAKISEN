// Apertura del detalle en tres tiempos:
//  1. crecer:   la tarjeta se levanta y se agranda (resorte).
//  2. expandir: se vuelve líquido y se derrama hacia abajo como una columna, con gotas
//               que caen por delante (filtro SVG #goo-hoja); luego se abre a lo ancho
//               hasta formar la hoja.
//  3. (app.ts)  aparece el panel: barrita para subir/bajar, cerrar y contenido.
// Al cerrar ocurre en reversa: la hoja se recoge en columna, sube y se funde con la
// tarjeta, que vuelve a su tamaño.

export type Caja = { x: number; y: number; w: number; h: number };
export const cajaDe = (el: Element): Caja => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

const css = (c: Caja, radio: string, extra: Keyframe = {}): Keyframe => ({ left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px`, borderRadius: radio, ...extra });
export const RADIO_HOJA = '28px 28px 0px 0px';
const RESORTE = 'cubic-bezier(0.34, 1.45, 0.6, 1)';
const CAE = 'cubic-bezier(0.5, 0, 0.75, 0.3)';
const ABRE = 'cubic-bezier(0.2, 0.85, 0.2, 1)';
export const ESCALA = 1.06;

/** Rectángulo visible de una imagen con object-fit: contain dentro de su caja. */
export function contenido(img: HTMLImageElement, caja = cajaDe(img)): Caja {
  const nw = img.naturalWidth || caja.w, nh = img.naturalHeight || caja.h;
  const s = Math.min(caja.w / nw, caja.h / nh);
  const w = nw * s, h = nh * s;
  return { x: caja.x + (caja.w - w) / 2, y: caja.y + (caja.h - h) / 2, w, h };
}

/** Caja de un elemento si estuviera escalado desde su centro. */
export const escalada = (c: Caja, s = ESCALA): Caja => ({ x: c.x - (c.w * (s - 1)) / 2, y: c.y - (c.h * (s - 1)) / 2, w: c.w * s, h: c.h * s });

export function crearLiquido() {
  const velo = document.getElementById('velo-hoja')!;
  const capa = document.createElement('div');
  capa.className = 'liquido';
  capa.setAttribute('aria-hidden', 'true');
  const cuerpo = document.createElement('i');
  const gota1 = document.createElement('i');
  const gota2 = document.createElement('i');
  capa.append(gota1, gota2, cuerpo);
  let vuelo: HTMLImageElement | null = null;

  const preparar = () => {
    [cuerpo, gota1, gota2, capa].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
    document.body.append(capa);
  };
  function limpiar() { capa.remove(); vuelo?.remove(); vuelo = null; }
  function veloSin(on: boolean) {
    velo.style.transition = 'none';
    velo.classList.toggle('on', on);
    void velo.offsetWidth;
    velo.style.transition = '';
  }

  /** 1 · La tarjeta se levanta y se agranda sobre el velo. */
  async function crecer(art: HTMLElement) {
    art.style.zIndex = '69';
    art.classList.add('elevada');
    velo.classList.add('on');
    await art.animate([{ transform: 'scale(1)' }, { transform: `scale(${ESCALA})` }], { duration: 360, easing: RESORTE, fill: 'forwards' }).finished;
  }
  /** La tarjeta vuelve a su tamaño. */
  async function soltar(art: HTMLElement) {
    art.style.visibility = '';
    await art.animate([{ transform: `scale(${ESCALA})` }, { transform: 'scale(1)' }], { duration: 420, easing: RESORTE, fill: 'forwards' }).finished;
    art.getAnimations().forEach((a) => a.cancel());
    art.style.zIndex = '';
    art.classList.remove('elevada');
  }

  /** 2 · Líquido: columna que cae hacia abajo y luego se abre en la hoja. */
  async function expandir(o: Caja, radio: number, d: Caja, dur = 760) {
    preparar();
    const ro = `${radio}px`;
    const fondo = innerHeight + 24;
    const columna: Caja = { x: o.x + o.w * 0.06, y: o.y, w: o.w * 0.88, h: fondo - o.y };
    const gx = o.x + o.w / 2;
    const g = Math.max(18, o.w * 0.16);
    const op = { duration: dur, easing: 'linear', fill: 'forwards' as const };
    const a = cuerpo.animate([
      css(o, ro, { easing: CAE }),
      css({ ...o, h: o.h * 1.08 }, `${ro} ${ro} ${o.w * 0.5}px ${o.w * 0.5}px`, { offset: 0.14, easing: CAE }),
      css(columna, `${ro} ${ro} ${o.w * 0.3}px ${o.w * 0.3}px`, { offset: 0.45, easing: ABRE }),
      css(d, RADIO_HOJA),
    ], op);
    // Dos gotas caen por delante de la columna y se funden con ella.
    const caer = (dx: number, retraso: number, t: number) => [
      css({ x: gx + dx - t / 2, y: o.y + o.h - t, w: t, h: t }, '50%'),
      css({ x: gx + dx - t / 2, y: o.y + o.h - t, w: t, h: t }, '50%', { offset: retraso, easing: CAE }),
      css({ x: gx + dx - t / 2, y: fondo - t * 0.4, w: t * 0.9, h: t * 1.3 }, '50%', { offset: Math.min(0.62, retraso + 0.3) }),
      css({ x: d.x + d.w / 2 + dx - t / 2, y: fondo - t, w: t, h: t }, '50%'),
    ];
    const b = gota1.animate(caer(-o.w * 0.18, 0.08, g), op);
    const c = gota2.animate(caer(o.w * 0.2, 0.16, g * 0.8), op);
    await Promise.all([a.finished, b.finished, c.finished]);
  }

  /** Reversa: la hoja se recoge en columna, sube y se funde con la tarjeta. */
  async function recoger(d: Caja, o: Caja, radio: number, dur = 720) {
    preparar();
    veloSin(true);
    const ro = `${radio}px`;
    const fondo = innerHeight + 24;
    const columna: Caja = { x: o.x + o.w * 0.06, y: o.y, w: o.w * 0.88, h: fondo - o.y };
    const gx = o.x + o.w / 2;
    const g = Math.max(18, o.w * 0.16);
    const op = { duration: dur, easing: 'linear', fill: 'forwards' as const };
    const a = cuerpo.animate([
      css(d, RADIO_HOJA, { easing: 'cubic-bezier(0.6, 0, 0.4, 1)' }),
      css(columna, `${ro} ${ro} ${o.w * 0.3}px ${o.w * 0.3}px`, { offset: 0.5, easing: 'cubic-bezier(0.3, 0, 0.2, 1)' }),
      css(o, ro),
    ], op);
    const subir = (dx: number, t: number) => [
      css({ x: d.x + d.w / 2 + dx - t / 2, y: fondo - t, w: t, h: t }, '50%'),
      css({ x: gx + dx - t / 2, y: fondo - t * 1.2, w: t, h: t * 1.3 }, '50%', { offset: 0.5 }),
      css({ x: gx + dx - t / 2, y: o.y + o.h - t, w: t, h: t }, '50%'),
    ];
    const b = gota1.animate(subir(-o.w * 0.18, g), op);
    const c = gota2.animate(subir(o.w * 0.2, g * 0.8), op);
    requestAnimationFrame(() => velo.classList.remove('on'));
    await Promise.all([a.finished, b.finished, c.finished]);
  }

  /** La foto del platillo viaja aparte, encima del líquido. */
  function volar(src: string, ajuste: 'contain' | 'cover', desde: Caja, hasta: Caja, radios: [string, string], dur = 760) {
    vuelo?.remove();
    vuelo = document.createElement('img');
    vuelo.src = src;
    vuelo.alt = '';
    vuelo.className = 'vuelo';
    vuelo.style.objectFit = ajuste;
    document.body.append(vuelo);
    return vuelo.animate(
      [css(desde, radios[0]), css(desde, radios[0], { offset: 0.1, easing: ABRE }), css(hasta, radios[1])],
      { duration: dur, easing: 'linear', fill: 'forwards' },
    ).finished;
  }
  const quitarVuelo = () => { vuelo?.remove(); vuelo = null; };
  const quitarCapa = async () => { await capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }).finished; capa.remove(); };

  return { crecer, soltar, expandir, recoger, volar, limpiar, quitarVuelo, quitarCapa, veloSin, RADIO_HOJA };
}
