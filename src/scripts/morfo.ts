// Transición del detalle del platillo («revelado en mármol»).
//  · Abrir: una lámina de mármol (#morfo, réplica exacta del panel sin contenido) crece
//    desde la tarjeta hasta la hoja o la ventana con clip-path; la foto vuela aparte con
//    transform + clip-path (FLIP), sin animar tamaño ni posición. Al llegar se abre el
//    <dialog> real encima y la lámina desaparece en el mismo cuadro. Mientras crece, la
//    tarjeta primero «se levanta», un filo dorado la bordea y una luz cruza el mármol.
//  · Cerrar: lo mismo en reversa, hacia la tarjeta; el platillo regresa en arco.
//  · Agregar: la foto del platillo vuela en arco hasta la bolsa de «Mi pedido» con una
//    estela de polvo de oro.
//  · Aterrizar: chispas de hoja de oro alrededor del ensō (máx. 12).
// Todo corre en el compositor o en pintura (clip-path); nada fuerza layout por cuadro.
import { alzaArco, chispas } from '../lib/detalle';

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
const recortePantalla = (c: Caja, r: Radios) =>
  `inset(${px(Math.max(0, c.y))} ${px(Math.max(0, anchoVista() - c.x - c.w))} ${px(Math.max(0, innerHeight - c.y - c.h))} ${px(Math.max(0, c.x))} round ${redondeo(r)})`;
/** Caja agrandada `d` px por lado (y sus radios): el filo y el «levantar» de la tarjeta. */
const inflar = (c: Caja, d: number): Caja => ({ x: c.x - d, y: c.y - d, w: c.w + d * 2, h: c.h + d * 2 });
const inflarR = (r: Radios, d: number): Radios => r.map((v) => (v > 0 ? v + d : 0)) as Radios;
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
  const filo = document.getElementById('morfo-filo')!;
  const lamina = capa.querySelector<HTMLElement>('.morfo-panel')!;
  const luz = capa.querySelector<HTMLElement>('.morfo-luz');
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
  function quitarFilo() {
    filo.getAnimations().forEach((a) => a.cancel());
    filo.hidden = true;
  }
  function detener() {
    capa.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    quitarFilo();
    vuelo?.getAnimations().forEach((a) => a.cancel());
  }

  /**
   * La lámina crece desde la tarjeta (C) hasta el panel (S). En el primer 12 % del tiempo
   * la tarjeta «se levanta» (crece 5 px por lado) y luego se abre; un filo dorado la bordea
   * mientras crece y una luz cruza el mármol en diagonal.
   */
  async function crecer(C: Caja, rC: Radios, S: Caja, rS: Radios, forma: Forma, dur: number) {
    detener();
    colocar(S, forma);
    capa.hidden = false;
    velo.classList.add('on');
    const alza = inflar(C, 5), rAlza = inflarR(rC, 5);
    const despega = 'cubic-bezier(0.2, 0.8, 0.3, 1)';
    const recorte = capa.animate([
      { clipPath: recortePantalla(C, rC), easing: despega },
      { clipPath: recortePantalla(alza, rAlza), offset: 0.12, easing: CAJON },
      { clipPath: recortePantalla(S, rS) },
    ], { duration: dur, fill: 'forwards' });
    capa.animate([{ opacity: 0 }, { opacity: 1 }], { duration: Math.min(80, dur * 0.2), easing: 'ease-out', fill: 'forwards' });
    filo.hidden = false;
    // El filo brilla cuando la lámina ya es opaca (si no, el oro se transparenta y tiñe la tarjeta).
    const F = (c: Caja, r: Radios) => recortePantalla(inflar(c, 1.5), inflarR(r, 1.5));
    filo.animate([
      { clipPath: F(C, rC), opacity: 0, easing: despega },
      { clipPath: F(alza, rAlza), opacity: 0.3, offset: 0.12, easing: CAJON },
      { opacity: 1, offset: 0.3 },
      { clipPath: F(S, rS), opacity: 0 },
    ], { duration: dur, fill: 'forwards' });
    luz?.animate([
      { transform: 'translateX(-70%) skewX(-16deg)', opacity: 0 },
      { opacity: 1, offset: 0.3 },
      { opacity: 0.9, offset: 0.7 },
      { transform: 'translateX(170%) skewX(-16deg)', opacity: 0 },
    ], { duration: dur * 1.1, easing: 'cubic-bezier(0.45, 0.05, 0.35, 1)', fill: 'forwards' });
    try { await recorte.finished; } catch { /* cancelada: el diálogo ya tomó su lugar */ }
    quitarFilo();
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
    capa.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    quitarFilo();
    capa.hidden = true;
    capa.style.opacity = '';
  }

  /**
   * La foto viaja de una caja a otra. El elemento vive en su tamaño final; al inicio se
   * escala hacia atrás (FLIP) y un clip-path recorta lo que la tarjeta dejaba ver.
   * Con `arco` (px) el platillo sube y baja por el camino (regreso a la tarjeta).
   */
  function volar(src: string, a: number, desde: Extremo, hasta: Extremo, dur: number, easing = CAJON, arco = 0) {
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
    const dx = R0.x - R1.x, dy = R0.y - R1.y;
    const inicio: Keyframe = { transform: `translate(${px(dx)}, ${px(dy)}) scale(${s}) rotate(0deg)`, clipPath: recorteLocal(desde.caja, R0, s, desde.radios) };
    const fin: Keyframe = { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', clipPath: recorteLocal(hasta.caja, R1, 1, hasta.radios) };
    if (!arco) return img.animate([inicio, fin], { duration: dur, easing, fill: 'forwards' }).finished;
    // Punto medio levantado (el clip-path se interpola solo entre los extremos). La escala del
    // punto medio es la media geométrica: el tamaño cambia parejo en todo el camino.
    const medio: Keyframe = { transform: `translate(${px(dx * 0.5)}, ${px(dy * 0.5 - arco)}) scale(${Math.sqrt(s)}) rotate(${dx > 0 ? 6 : -6}deg)`, offset: 0.5 };
    return img.animate([
      { ...inicio, easing: 'cubic-bezier(0.3, 0.7, 0.5, 1)' },
      { ...medio, easing: 'cubic-bezier(0.5, 0, 0.25, 1)' },
      fin,
    ], { duration: dur, fill: 'forwards' }).finished;
  }
  function quitarVuelo() { vuelo?.remove(); vuelo = null; }

  return { crecer, recoger, volar, quitarVuelo, ocultar, veloSin };
}

/**
 * Al agregar: una miniatura del platillo sale de su foto y cae en arco dentro de la bolsa,
 * seguida por una estela de polvo de oro (las chispas recorren el mismo camino un poco
 * después). `desde` es el rectángulo visible de la imagen; `destino`, la caja de la bolsa.
 * `alAcercarse` corre a la mitad del vuelo (la bolsa abre la boca para recibirla).
 */
export async function aLaBolsa(src: string, a: number, desde: Caja, destino: Caja, redonda: boolean, alAcercarse?: () => void) {
  const lado = 34;
  const T: Caja = redonda
    ? { x: destino.x + destino.w / 2 - lado / 2, y: destino.y + destino.h / 2 - lado / 2, w: lado, h: lado }
    : rectImagen({ x: destino.x + destino.w / 2 - lado / 2, y: destino.y + destino.h / 2 - lado / 2, w: lado, h: lado }, a, 'contain');
  // Para fotos a sangre se toma un cuadro centrado (se ve como una moneda que cae).
  const lado0 = Math.min(desde.w, desde.h) * (redonda ? 0.62 : 1);
  const D: Caja = redonda ? { x: desde.x + desde.w / 2 - lado0 / 2, y: desde.y + desde.h / 2 - lado0 / 2, w: lado0, h: lado0 } : desde;
  const s = D.w / T.w;
  // Una sola capa con la miniatura y la estela. Como popover vive en la capa superior: se ve
  // encima de la hoja aunque siga abierta.
  const capa = document.createElement('div');
  capa.className = 'vuelo-capa';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.className = 'vuelo a-la-bolsa';
  if (redonda) img.classList.add('redonda');
  Object.assign(img.style, { left: px(T.x), top: px(T.y), width: px(T.w), height: px(T.h) });
  const dx = D.x - T.x, dy = D.y - T.y;
  // Punto alto del arco: la miniatura sube un poco antes de caer.
  const ms = Math.max(1, s * 0.55);
  const giro = dx > 0 ? -8 : 8;
  const sube = 'cubic-bezier(0.2, 0.6, 0.35, 1)';
  const cae = 'cubic-bezier(0.55, 0, 0.85, 0.36)';
  type Paso = { tx: number; ty: number; k: number };
  const pasos: [Paso, Paso, Paso] = [
    { tx: dx, ty: dy, k: s },
    { tx: dx * 0.45, ty: Math.min(dy, 0) * 0.55 - alzaArco(dx, dy), k: ms },
    { tx: 0, ty: 0, k: 1 },
  ];
  const dur = 720;
  const N = 8;
  const estela = Array.from({ length: N }, (_, i) => {
    const e = document.createElement('i');
    e.className = 'estela';
    const t = 9 - i * 0.75;
    Object.assign(e.style, { left: px(T.x + T.w / 2 - t / 2), top: px(T.y + T.h / 2 - t / 2), width: px(t), height: px(t) });
    return e;
  });
  capa.append(...estela, img);
  document.body.append(capa);
  if (typeof capa.showPopover === 'function') { capa.popover = 'manual'; capa.showPopover(); }
  const anim = img.animate([
    { transform: `translate(${px(pasos[0].tx)}, ${px(pasos[0].ty)}) scale(${s})`, opacity: 1, easing: sube },
    { transform: `translate(${px(pasos[1].tx)}, ${px(pasos[1].ty)}) scale(${ms}) rotate(${giro}deg)`, opacity: 1, offset: 0.42, easing: cae },
    { transform: 'translate(0px, 0px) scale(1) rotate(0deg)', opacity: 1, offset: 0.92 },
    { transform: 'translate(0px, 4px) scale(0.6)', opacity: 0 },
  ], { duration: dur, fill: 'forwards' });
  // La estela sigue el centro de la miniatura: con el origen en la esquina, el centro está en
  // translate + (k − 1)·(lado / 2) respecto al centro de reposo de cada chispa.
  const [c0, c1, c2] = pasos.map((p) => ({ x: p.tx + (p.k - 1) * (T.w / 2), y: p.ty + (p.k - 1) * (T.h / 2) })) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  estela.forEach((e, i) => {
    const brillo = 0.95 - i * 0.08;
    e.animate([
      { transform: `translate(${px(c0.x)}, ${px(c0.y)}) rotate(45deg) scale(0.4)`, opacity: 0, easing: sube },
      { transform: `translate(${px(c1.x)}, ${px(c1.y)}) rotate(45deg) scale(1)`, opacity: brillo, offset: 0.42, easing: cae },
      { transform: `translate(${px(c2.x)}, ${px(c2.y)}) rotate(45deg) scale(0.7)`, opacity: brillo * 0.6, offset: 0.92 },
      { transform: `translate(${px(c2.x)}, ${px(c2.y)}) rotate(45deg) scale(0.2)`, opacity: 0 },
    ], { duration: dur, delay: 30 + i * 22, fill: 'both' });
  });
  const t = alAcercarse ? window.setTimeout(alAcercarse, dur * 0.5) : 0;
  try { await anim.finished; } catch { clearTimeout(t); }
  img.remove();
  // La estela termina sola unos milisegundos después; luego se quita la capa completa.
  window.setTimeout(() => capa.remove(), 40 + N * 22);
}

/**
 * Chispas de hoja de oro que salen del anillo del ensō al aterrizar el platillo (máx. 12).
 * `cx`, `cy` y `radio` en px relativos al contenedor (que recorta con overflow).
 */
export function chispear(contenedor: HTMLElement, cx: number, cy: number, radio: number, semilla = Date.now() % 997) {
  return Promise.all(chispas(12, radio, semilla).map((c) => {
    const e = document.createElement('i');
    e.className = c.alargada ? 'chispa alargada' : 'chispa';
    const w = c.alargada ? c.tam * 2.6 : c.tam;
    Object.assign(e.style, { left: px(cx - w / 2), top: px(cy - c.tam / 2), width: px(w), height: px(c.tam) });
    contenedor.append(e);
    const a = (c.angulo * Math.PI) / 180;
    const x0 = Math.cos(a) * c.desde, y0 = Math.sin(a) * c.desde;
    const x1 = Math.cos(a) * c.hasta, y1 = Math.sin(a) * c.hasta;
    // Las alargadas apuntan hacia afuera (destello); las demás giran como hojuelas que caen.
    const base = c.alargada ? c.angulo : 45;
    // Salen disparadas (rápido al principio), brillan un momento y se apagan mientras caen.
    const en = (t: number) => ({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
    const m1 = en(0.62), m2 = en(0.9);
    return e.animate([
      { transform: `translate(${px(x0)}, ${px(y0)}) rotate(${base}deg) scale(0.4)`, opacity: 0, easing: 'cubic-bezier(0.2, 0.9, 0.4, 1)' },
      { transform: `translate(${px(m1.x)}, ${px(m1.y)}) rotate(${base + c.giro * 0.4}deg) scale(1)`, opacity: 1, offset: 0.3, easing: 'linear' },
      { transform: `translate(${px(m2.x)}, ${px(m2.y + 3)}) rotate(${base + c.giro * 0.75}deg) scale(0.9)`, opacity: 0.95, offset: 0.62, easing: 'ease-in' },
      { transform: `translate(${px(x1)}, ${px(y1 + 10)}) rotate(${base + c.giro}deg) scale(0.4)`, opacity: 0 },
    ], { duration: 1050, delay: c.retraso, fill: 'both' })
      .finished.catch(() => undefined).then(() => e.remove());
  }));
}
