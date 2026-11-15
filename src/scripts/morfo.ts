// Transición del detalle del platillo («revelado en mármol»).
//  · Abrir: una lámina de mármol (#morfo, réplica exacta del panel sin contenido) crece
//    desde la tarjeta hasta la hoja o la ventana con clip-path; la foto vuela aparte con
//    transform + clip-path (FLIP), sin animar tamaño ni posición. Al llegar se abre el
//    <dialog> real encima y la lámina desaparece en el mismo cuadro.
//  · Cerrar: lo mismo en reversa, hacia la tarjeta.
//  · Agregar: la foto del platillo vuela en arco hasta la bolsa de Mi lista.
// Todo corre en el compositor o en pintura (clip-path); nada fuerza layout por cuadro.

export type Caja = { x: number; y: number; w: number; h: number };
/** Radios [sup-izq, sup-der, inf-der, inf-izq] en px. */
export type Radios = [number, number, number, number];
export type Ajuste = 'contain' | 'cover';
export type Forma = 'hoja' | 'ventana';

/** Ancho útil de la vista (sin la barra de desplazamiento clásica): el mismo que usan
 *  el <dialog> modal y las capas fijas. innerWidth sí la incluye. */
export const anchoVista = () => document.documentElement.getBoundingClientRect().width || innerWidth;
export const cajaDe = (el: Element): Caja => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
export const radios = (r: number): Radios => [r, r, r, r];
/** Curva de cajón (tipo iOS): arranca rápido y se asienta suave. */
export const CAJON = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Rectángulo que ocupa una imagen de proporción `a` (ancho/alto) dentro de una caja. */
export function rectImagen(caja: Caja, a: number, ajuste: Ajuste): Caja {
  const w = ajuste === 'cover' ? Math.max(caja.w, caja.h * a) : Math.min(caja.w, caja.h * a);
  const h = w / a;
  return { x: caja.x + (caja.w - w) / 2, y: caja.y + (caja.h - h) / 2, w, h };
}
export const proporcion = (img: HTMLImageElement, caja = cajaDe(img)) => (img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : caja.w / Math.max(1, caja.h));

const px = (n: number) => `${Math.round(n * 100) / 100}px`;
const redondeo = (r: Radios, s = 1) => r.map((v) => px(Math.max(0, v / s))).join(' ');
/** clip-path en coordenadas de pantalla para una capa fija a pantalla completa. */
const recortePantalla = (c: Caja, r: Radios) => `inset(${px(c.y)} ${px(anchoVista() - c.x - c.w)} ${px(innerHeight - c.y - c.h)} ${px(c.x)} round ${redondeo(r)})`;
/** clip-path local de un elemento escalado `s` cuya caja en pantalla es R, para dejar ver solo `vis`. */
const recorteLocal = (vis: Caja, R: Caja, s: number, r: Radios) => {
  const t = Math.max(0, (vis.y - R.y) / s), l = Math.max(0, (vis.x - R.x) / s);
  const b = Math.max(0, (R.y + R.h - vis.y - vis.h) / s), d = Math.max(0, (R.x + R.w - vis.x - vis.w) / s);
  return `inset(${px(t)} ${px(d)} ${px(b)} ${px(l)} round ${redondeo(r, s)})`;
};

type Extremo = { caja: Caja; ajuste: Ajuste; radios: Radios };

export function crearMorfo() {
  const velo = document.getElementById('velo-hoja')!;
  const capa = document.getElementById('morfo')!;
  const lamina = capa.querySelector<HTMLElement>('.morfo-panel')!;
  let vuelo: HTMLImageElement | null = null;

  function veloSin(on: boolean) {
    velo.style.transition = 'none';
    velo.classList.toggle('on', on);
    void velo.offsetWidth;
    velo.style.transition = '';
  }
  /** Coloca la réplica del panel en su caja final (misma textura que el panel real). */
  function colocar(S: Caja, forma: Forma) {
    capa.dataset.forma = forma;
    Object.assign(lamina.style, { left: px(S.x), top: px(S.y), width: px(S.w), height: px(S.h) });
  }
  function detener() {
    capa.getAnimations().forEach((a) => a.cancel());
    vuelo?.getAnimations().forEach((a) => a.cancel());
  }

  /** La lámina crece desde la tarjeta (C) hasta el panel (S). */
  async function crecer(C: Caja, rC: Radios, S: Caja, rS: Radios, forma: Forma, dur: number) {
    detener();
    colocar(S, forma);
    capa.hidden = false;
    velo.classList.add('on');
    const recorte = capa.animate([{ clipPath: recortePantalla(C, rC) }, { clipPath: recortePantalla(S, rS) }], { duration: dur, easing: CAJON, fill: 'forwards' });
    capa.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(140, dur * 0.3), easing: 'ease-out', fill: 'forwards' });
    await recorte.finished;
  }

  /** Reversa: la lámina se recoge desde el panel hasta la tarjeta y se desvanece. */
  async function recoger(S: Caja, rS: Radios, C: Caja, rC: Radios, forma: Forma, dur: number) {
    detener();
    colocar(S, forma);
    capa.style.opacity = '1';
    capa.hidden = false;
    veloSin(true);
    requestAnimationFrame(() => velo.classList.remove('on'));
    await capa.animate([{ clipPath: recortePantalla(S, rS) }, { clipPath: recortePantalla(C, rC) }], { duration: dur, easing: CAJON, fill: 'forwards' }).finished;
    await capa.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 120, easing: 'ease-out', fill: 'forwards' }).finished;
    ocultar();
  }

  function ocultar() {
    capa.getAnimations().forEach((a) => a.cancel());
    capa.hidden = true;
    capa.style.opacity = '';
  }

  /**
   * La foto viaja de una caja a otra. El elemento vive en su tamaño final; al inicio se
   * escala hacia atrás (FLIP) y un clip-path recorta lo que la tarjeta dejaba ver.
   */
  function volar(src: string, a: number, desde: Extremo, hasta: Extremo, dur: number, easing = CAJON) {
    quitarVuelo();
    const R0 = rectImagen(desde.caja, a, desde.ajuste);
    const R1 = rectImagen(hasta.caja, a, hasta.ajuste);
    const s = R0.w / R1.w;
    const img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.className = 'vuelo';
    Object.assign(img.style, { left: px(R1.x), top: px(R1.y), width: px(R1.w), height: px(R1.h) });
    document.body.append(img);
    vuelo = img;
    return img.animate([
      { transform: `translate(${px(R0.x - R1.x)}, ${px(R0.y - R1.y)}) scale(${s})`, clipPath: recorteLocal(desde.caja, R0, s, desde.radios) },
      { transform: 'none', clipPath: recorteLocal(hasta.caja, R1, 1, hasta.radios) },
    ], { duration: dur, easing, fill: 'forwards' }).finished;
  }
  function quitarVuelo() { vuelo?.remove(); vuelo = null; }

  return { crecer, recoger, volar, quitarVuelo, ocultar, veloSin };
}

/**
 * Al agregar: una miniatura del platillo sale de su foto y cae en arco dentro de la bolsa.
 * `desde` es el rectángulo visible de la imagen; `destino`, la caja de la bolsa.
 */
export async function aLaBolsa(src: string, a: number, desde: Caja, destino: Caja, redonda: boolean) {
  const lado = 34;
  const T: Caja = redonda
    ? { x: destino.x + destino.w / 2 - lado / 2, y: destino.y + destino.h / 2 - lado / 2, w: lado, h: lado }
    : rectImagen({ x: destino.x + destino.w / 2 - lado / 2, y: destino.y + destino.h / 2 - lado / 2, w: lado, h: lado }, a, 'contain');
  // Para fotos a sangre se toma un cuadro centrado (se ve como una moneda que cae).
  const lado0 = Math.min(desde.w, desde.h) * (redonda ? 0.62 : 1);
  const D: Caja = redonda ? { x: desde.x + desde.w / 2 - lado0 / 2, y: desde.y + desde.h / 2 - lado0 / 2, w: lado0, h: lado0 } : desde;
  const s = D.w / T.w;
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = 'vuelo a-la-bolsa';
  if (redonda) img.classList.add('redonda');
  Object.assign(img.style, { left: px(T.x), top: px(T.y), width: px(T.w), height: px(T.h) });
  document.body.append(img);
  // Como popover vive en la capa superior: se ve encima de la hoja aunque siga abierta.
  if (typeof img.showPopover === 'function') { img.popover = 'manual'; img.showPopover(); }
  const dx = D.x - T.x, dy = D.y - T.y;
  // Punto medio levantado: la miniatura sube un poco antes de caer (arco).
  const alza = Math.min(140, Math.max(60, Math.abs(dy) * 0.35));
  const ms = Math.max(1, s * 0.55);
  const anim = img.animate([
    { transform: `translate(${px(dx)}, ${px(dy)}) scale(${s})`, opacity: 1, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)' },
    { transform: `translate(${px(dx * 0.45)}, ${px(Math.min(dy, 0) * 0.55 - alza)}) scale(${ms}) rotate(-8deg)`, opacity: 1, offset: 0.42, easing: 'cubic-bezier(0.55, 0, 0.85, 0.36)' },
    { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1, offset: 0.92 },
    { transform: 'translate(0px, 4px) scale(0.6)', opacity: 0 },
  ], { duration: 680, fill: 'forwards' });
  try { await anim.finished; } catch { /* cancelada */ }
  img.remove();
}
