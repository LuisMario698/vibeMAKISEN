// Transición del detalle del platillo («revelado en mármol»).
//  · Abrir: una lámina de mármol (#morfo, réplica exacta del panel sin contenido) crece
//    desde la tarjeta hasta la hoja o la ventana con clip-path; la foto vuela aparte con
//    transform + clip-path (FLIP), sin animar tamaño ni posición. Al llegar se abre el
//    <dialog> real encima y la lámina desaparece en el mismo cuadro. Mientras crece, la
//    tarjeta primero «se levanta», un filo dorado la bordea y una luz cruza el mármol.
//  · Cerrar: lo mismo en reversa, hacia la tarjeta; el platillo regresa en arco.
//  · Agregar: la miniatura del platillo vuela en arco (una parábola muestreada) hasta la
//    bolsa de «Mi pedido» con una estela de polvo de oro; la orquesta bolsa.ts.
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

/* ── Vuelo a la bolsa de «Mi pedido» ──────────────────────────────────────
   Un solo trayecto (parábola de Bézier cuadrática) muestreado en cuadros clave con
   interpolación lineal: la miniatura avanza parejo en horizontal, sube y cae sin
   detenerse en la cima (con dos tramos con curvas distintas se frenaba arriba). La
   estela recorre los mismos puntos un poco después. Todo es transform/opacity. */

/** cubic-bezier(x1, y1, x2, y2) como función de t ∈ [0, 1] (Newton con respaldo de bisección). */
export function curva(x1: number, y1: number, x2: number, y2: number) {
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  const dx = (t: number) => 3 * (1 - t) * (1 - t) * x1 + 6 * (1 - t) * t * (x2 - x1) + 3 * t * t * (1 - x2);
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = bx(t) - x;
      if (Math.abs(e) < 1e-5) return by(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) { if (bx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return by(t);
  };
}

export type Punto = { t: number; x: number; y: number; k: number; r: number; o: number };
/** Parte del tiempo en que la miniatura ya llegó a la boca de la bolsa; el resto es «entrar». */
export const LLEGA = 0.86;
// Avance casi lineal: con la parábola de Bézier eso es un tiro con gravedad real (horizontal
// parejo, cae acelerando) y llega a la bolsa con velocidad. Con una curva de salida suave el
// último 30 % del tiempo apenas recorría el 7 % del camino y la miniatura «se quedaba» junto a
// la bolsa antes de que esta reaccionara.
const AVANCE = curva(0.3, 0.3, 0.7, 0.75);

/**
 * Trayecto de la miniatura hacia la bolsa, relativo al centro de la bolsa.
 * `dx`, `dy`: centro de salida − centro de la bolsa (px). `s`: escala inicial (tamaño de salida /
 * tamaño final). `alza`: cuánto sube la cima por encima del punto más alto de los extremos.
 * Devuelve `n` + 2 puntos con su tiempo `t` ∈ [0, 1]: sale grande, se despega con un pequeño
 * respiro de escala, viaja en arco y al final «entra» en la bolsa (baja 5 px, se encoge y se apaga).
 * Con `nace` (moneda o icono, que no existen en la página) aparece con un fundido muy corto.
 */
export function trayectoria(dx: number, dy: number, s: number, alza: number, n = 18, nace = false): Punto[] {
  // Control de la Bézier para que la cima real (el mínimo de y) quede en M = min(dy, 0) − alza:
  // el mínimo de (1−u)²·dy + 2u(1−u)·c es −c² / (dy − 2c)  →  c = M − √(M² − M·dy).
  const M = Math.min(dy, 0) - Math.max(0, alza);
  const cy = M - Math.sqrt(Math.max(0, M * M - M * dy));
  const giro = Math.abs(dx) < 8 ? 0 : dx > 0 ? -9 : 9;
  const s0 = Math.max(0.2, s);
  const pts: Punto[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * LLEGA;
    const u = AVANCE(i / n);
    const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u;
    const respiro = 1 + 0.08 * Math.sin(Math.PI * Math.min(1, u / 0.3));
    pts.push({
      t,
      x: a * dx + b * (dx / 2),
      y: a * dy + b * cy,
      k: Math.pow(s0, 1 - u) * (u < 0.3 ? respiro : 1),
      r: giro * Math.sin(Math.PI * u),
      o: nace ? Math.min(1, u / 0.08) : 1,
    });
  }
  pts.push({ t: (LLEGA + 1) / 2, x: 0, y: 3, k: 0.8, r: 0, o: 0.85 });
  pts.push({ t: 1, x: 0, y: 6, k: 0.45, r: 0, o: 0 });
  return pts;
}

/** Duración del vuelo según la distancia: corto y ágil cerca, nunca lento lejos. */
export const duracionVuelo = (d: number) => Math.round(Math.min(580, Math.max(420, 360 + d * 0.3)));

/** 'recorte': el platillo recortado tal cual; 'moneda': foto en círculo con aro de oro;
 *  'icono': el icono de la categoría en una moneda oscura (sobre la isla dorada no se perdería). */
export type Forma_Vuelo = 'recorte' | 'moneda' | 'icono';
export type Vuelo = { llego: Promise<void>; terminar: () => void; dur: number };
const vuelos = new Set<Vuelo>();
/** Máximo de miniaturas en el aire: al pasar el tope, la más antigua llega de inmediato. */
const MAX_VUELOS = 3;
/** Termina todos los vuelos en curso (llegan al instante, sin capas huérfanas). */
export function aterrizarVuelos() { [...vuelos].forEach((v) => v.terminar()); }

/**
 * La miniatura del platillo viaja de `desde` (rectángulo visible en pantalla) a la bolsa
 * (`destino`) con la `forma` de Forma_Vuelo. `llego` se resuelve al
 * llegar a la boca de la bolsa, o al instante si el vuelo se termina antes (terminar()).
 * `seguir` da la caja vigente de la bolsa (si se mueve, el trayecto se corrige); `listaEn`, en
 * cuántos ms termina de formarse (la isla que aparece): el despegue espera lo justo.
 */
export function aLaBolsa(src: string, a: number, desde: Caja, destino: Caja, forma: Forma_Vuelo, o: { seguir?: (() => Caja | null) | undefined; listaEn?: number | undefined } = {}): Vuelo {
  const { seguir, listaEn = 0 } = o;
  if (vuelos.size >= MAX_VUELOS) [...vuelos][0]?.terminar();
  const lado = forma === 'recorte' ? 36 : 30;
  const cx = destino.x + destino.w / 2, cy = destino.y + destino.h / 2;
  const T: Caja = forma !== 'recorte'
    ? { x: cx - lado / 2, y: cy - lado / 2, w: lado, h: lado }
    : rectImagen({ x: cx - lado / 2, y: cy - lado / 2, w: lado, h: lado }, a, 'contain');
  const D: Caja = forma !== 'recorte'
    // De una foto grande sale una moneda del centro (no un disco del tamaño de la foto).
    ? (() => { const m = Math.min(desde.w, desde.h); const l = m > 80 ? Math.max(80, m * 0.5) : m; return { x: desde.x + desde.w / 2 - l / 2, y: desde.y + desde.h / 2 - l / 2, w: l, h: l }; })()
    : desde;
  const s = D.w / T.w;
  const dx = D.x + D.w / 2 - cx, dy = D.y + D.h / 2 - cy;
  // Si sale por encima de la bolsa (lo común), apenas brinca; si sale por debajo, sube más.
  const alza = alzaArco(dx, dy) * (dy < 0 ? 0.35 : 1);
  const pts = trayectoria(dx, dy, s, alza, 18, forma !== 'recorte');
  const dur = duracionVuelo(Math.hypot(dx, dy));

  // Una capa en la capa superior (popover): se ve encima de la hoja aunque siga abierta.
  const capa = document.createElement('div');
  capa.className = 'vuelo-capa';
  capa.setAttribute('aria-hidden', 'true');
  const mini = document.createElement('div');
  mini.className = `vuelo vuelo-mini ${forma}`;
  // Cadena CSS entre comillas: solo se escapan comillas, barras y saltos (los data: URI ya vienen codificados).
  mini.style.backgroundImage = `url("${src.replace(/["\\\n\r]/g, (c) => encodeURIComponent(c))}")`;
  Object.assign(mini.style, { left: px(T.x), top: px(T.y), width: px(T.w), height: px(T.h) });
  const N = 7;
  const estela = Array.from({ length: N }, (_, i) => {
    const e = document.createElement('i');
    e.className = 'estela';
    const t = 8 - i * 0.7;
    Object.assign(e.style, { left: px(cx - t / 2), top: px(cy - t / 2), width: px(t), height: px(t) });
    return e;
  });
  // Capa de ajuste: si la bolsa se mueve durante el vuelo (la píldora cambia de ancho al cambiar
  // de categoría), todo el trayecto se corrige poco a poco hacia su nuevo lugar.
  const ajuste = document.createElement('div');
  ajuste.className = 'vuelo-ajuste';
  ajuste.append(...estela, mini);
  capa.append(ajuste);
  document.body.append(capa);
  try { capa.popover = 'manual'; capa.showPopover(); } catch { /* sin popover: z-index alto */ }

  // Dos tramos en el mismo reloj: el viaje hasta la boca de la bolsa (ahí «llega» y la bolsa
  // reacciona en ese mismo cuadro) y el instante en que entra y se apaga dentro de ella.
  const cuadro = (p: Punto, offset: number): Keyframe => ({
    offset, opacity: p.o,
    transform: `translate(${px(p.x)}, ${px(p.y)}) scale(${Math.round(p.k * 1000) / 1000}) rotate(${Math.round(p.r * 10) / 10}deg)`,
  });
  const viaje = pts.filter((p) => p.t <= LLEGA);
  const durViaje = Math.round(dur * LLEGA);
  const retraso = Math.round(Math.min(320, Math.max(0, listaEn - durViaje)));
  const anim = mini.animate(viaje.map((p) => cuadro(p, p.t / LLEGA)), { duration: durViaje, delay: retraso, easing: 'linear', fill: 'both' });
  // La estela: los mismos puntos, cada chispa un poco después y apagándose al llegar.
  const chispasVuelo = estela.map((e, i) => e.animate(viaje.map((p, j, arr) => {
    const q = j / (arr.length - 1);
    const brillo = (0.9 - i * 0.09) * (q < 0.12 ? q / 0.12 : q > 0.8 ? Math.max(0, (1 - q) / 0.2) : 1);
    return { offset: p.t / LLEGA, opacity: Math.round(brillo * 100) / 100, transform: `translate(${px(p.x)}, ${px(p.y)}) rotate(45deg) scale(${Math.round((1 - q * 0.45) * 100) / 100})` };
  }), { duration: durViaje, delay: retraso + 26 + i * 24, easing: 'linear', fill: 'both' }));

  // El tramo de entrar ya queda programado (empieza justo cuando termina el viaje): encadenarlo
  // al terminar costaba uno o dos cuadros con la miniatura quieta sobre la bolsa.
  const entra = pts.filter((p) => p.t >= LLEGA);
  const fin = mini.animate(entra.map((p) => cuadro(p, (p.t - LLEGA) / (1 - LLEGA))), { duration: Math.max(60, dur - durViaje), delay: retraso + durViaje, easing: 'cubic-bezier(0.2, 0, 0.4, 1)', fill: 'forwards' });
  // La capa se va cuando la miniatura entró y la estela terminó (o se canceló): nunca queda huérfana.
  void Promise.allSettled([fin.finished, ...chispasVuelo.map((c) => c.finished)]).then(() => capa.remove());

  let listo = false;
  const vuelo: Vuelo = {
    dur: retraso + durViaje,
    llego: anim.finished.then(() => undefined, () => undefined).then(() => {
      listo = true;
      vuelos.delete(vuelo);
    }),
    terminar() {
      if (listo) return;
      chispasVuelo.forEach((c) => c.cancel());
      fin.finish();
      anim.finish();
    },
  };
  vuelos.add(vuelo);
  if (seguir) {
    let ox = 0, oy = 0;
    const paso = () => {
      if (listo) return;
      const d = seguir();
      if (d) {
        const p = Math.min(1, Math.max(0, Number(anim.currentTime ?? 0) - retraso) / durViaje);
        ox += ((d.x + d.w / 2 - cx) * p - ox) * 0.4;
        oy += ((d.y + d.h / 2 - cy) * p - oy) * 0.4;
        if (Math.abs(ox) + Math.abs(oy) > 0.5) ajuste.style.transform = `translate(${px(ox)}, ${px(oy)})`;
      }
      requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  }
  return vuelo;
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
