// Modo presentación (?demo=1): recorre solo el menú REAL para enseñárselo al dueño.
// Un dedo/cursor dorado (ensō con su punto) va de control en control y los toca con eventos
// de verdad (pointer, click, input) sobre los elementos de la app; un subtítulo en versalitas
// narra cada paso y un filete dorado con el punto del logo marca el avance.
//
// - El guion y la lógica de tiempos/pausa/trayectoria son datos puros (src/lib/presentacion.ts).
// - El pedido vive en memoria mientras dura (src/scripts/aislar.ts): el carrito real no se toca.
// - Nunca abre WhatsApp, llamadas ni mapas externos: esos clics se interceptan.
// - Cualquier toque de la persona pausa; Escape sale; → o AvPág pasan al siguiente paso.
// - Salir (o «Explorar yo mismo») recarga la página sin ?demo: todo vuelve a su estado normal.
// - Computadora (≥ 64rem × 36rem): «escenario». El menú corre dentro de un marco de teléfono (un
//   iframe del mismo sitio a 390×844 con ?demo=1&marco=1), que es lo que verán los comensales, y
//   la narración va al lado en letra grande. El iframe hace el recorrido y avisa por postMessage
//   (mismo origen) qué paso va; el escenario manda pausa, siguiente y salir, y pone la tarjeta final.
// Este módulo solo se descarga con ?demo=1 (import dinámico desde app.ts). Sus estilos van
// dentro del mismo paquete (?inline): importados normal, Astro los pondría en todas las páginas.
import estilos from '../styles/presentacion.css?inline';
import { trazoEnso } from '../lib/detalle';
import {
  CIERRE, crearReloj, duracionMovimiento, enMarco, escalaDe, escalaTelefono, esEnlaceExterno, GUION, LECTURA, progreso, suave, TELEFONO, trayectoria,
  urlDemo, urlMarco, urlSinDemo,
  type Accion, type Limpieza, type Paso, type Punto, type Txt,
} from '../lib/presentacion';
import { avisar, html, ponerBi, reducir } from './comun';

/** Se lanza para cortar el paso en curso (siguiente paso o salir). */
const CORTE = Symbol('corte');
/** Un paso no pudo hacerse (selector ausente o tiempo agotado): se pasa al siguiente. */
class Fallo extends Error {}

const ICONOS = {
  pausa: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/><rect x="13.9" y="5" width="3.6" height="14" rx="1.4" fill="currentColor"/></svg>',
  seguir: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M8 5.6v12.8a1 1 0 0 0 1.5.86l10.2-6.4a1 1 0 0 0 0-1.72L9.5 4.74A1 1 0 0 0 8 5.6z" fill="currentColor"/></svg>',
  siguiente: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6l7 6-7 6"/><path d="M13 6l7 6-7 6"/></svg>',
  salir: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
};
// Ensō de pincel con el hueco y el punto arriba a la derecha, como en el isotipo de MAKIZEN.
const ENSO = trazoEnso({ inicio: -14, barrido: 318, grosor: 17, muestras: 72 });
const HUECO = ((-14 - 21) * Math.PI) / 180;
const PUNTO = { x: Math.round((100 + 84 * Math.cos(HUECO)) * 10) / 10, y: Math.round((100 + 84 * Math.sin(HUECO)) * 10) / 10 };
const CURSOR = `<span class="pz-cursor-cuerpo"><svg viewBox="-8 -8 216 216" aria-hidden="true" focusable="false">
<defs><linearGradient id="pz-oro" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecd598"/><stop offset="0.5" stop-color="#c9a54f"/><stop offset="1" stop-color="#8a6d2f"/></linearGradient></defs>
<circle cx="100" cy="100" r="74" class="pz-cursor-disco"/><path d="${ENSO}" class="pz-cursor-contorno"/><circle cx="${PUNTO.x}" cy="${PUNTO.y}" r="13" class="pz-cursor-contorno"/>
<path d="${ENSO}" class="pz-cursor-enso"/><circle cx="${PUNTO.x}" cy="${PUNTO.y}" r="13" class="pz-cursor-punto"/></svg></span>`;

function nodo<K extends keyof HTMLElementTagNameMap>(tag: K, clase = '', hijos: (Node | string)[] = []) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  n.append(...hijos);
  return n;
}
/** Texto bilingüe como nodos (el CSS del sitio muestra solo el idioma activo). */
function bi(t: Txt, clase = '') {
  const n = nodo('span', clase);
  ponerBi(n, t.es, t.en);
  return n;
}
const visible = (el: Element | null): el is HTMLElement => {
  if (!(el instanceof HTMLElement) || !el.isConnected || el.closest('[inert], [hidden]')) return false;
  const r = el.getBoundingClientRect();
  // Fuera de la pantalla también vale (se trae a la vista), siempre que tenga caja.
  return r.width >= 2 && r.height >= 2 && getComputedStyle(el).visibility !== 'hidden';
};
const centro = (el: Element): Punto => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };
const ponerEstilos = () => {
  const hoja = document.createElement('style');
  hoja.textContent = estilos;
  document.head.append(hoja);
};
/** Mensajes entre el escenario (página de arriba) y el teléfono (iframe). Solo del mismo origen. */
type MsgTelefono = { pz: 'paso'; i: number } | { pz: 'avance'; p: number } | { pz: 'estado'; pausa: boolean } | { pz: 'final' } | { pz: 'salir' } | { pz: 'lang'; lang: string };
type MsgEscenario = { pz: 'ctl'; accion: 'pausa' | 'seguir' | 'siguiente' | 'salir' };
const ESCRITORIO = '(min-width: 64rem) and (min-height: 36rem)';

/** Tarjeta final (la misma en el teléfono y en el escenario): beneficios, paso siguiente y dos salidas. */
function crearFinal(salir: (destino?: string) => void) {
  const final = nodo('dialog', 'pz-final');
  final.setAttribute('aria-labelledby', 'pz-final-t');
  const logo = nodo('img', 'pz-final-logo') as HTMLImageElement;
  logo.src = '/brand/isotipo.svg'; logo.alt = ''; logo.width = 579; logo.height = 599;
  const h = nodo('h2', 'pz-final-titulo', [bi(CIERRE.titulo)]);
  h.id = 'pz-final-t';
  h.tabIndex = -1;
  const fil = nodo('div', 'filete pz-final-filete', [nodo('b'), nodo('i'), nodo('b')]);
  fil.setAttribute('aria-hidden', 'true');
  const ul = nodo('ul', 'pz-final-lista', CIERRE.beneficios.map((b) => nodo('li', '', [bi(b)])));
  const sig = nodo('div', 'pz-final-siguiente', [nodo('p', 'pz-final-rotulo', [bi(CIERRE.siguiente.rotulo)]), nodo('p', 'pz-final-texto', [bi(CIERRE.siguiente.texto)])]);
  const nota = nodo('p', 'pz-final-nota', [bi(CIERRE.nota)]);
  const otra = nodo('button', 'boton-linea presionable pz-final-boton', [bi(CIERRE.otraVez)]);
  otra.type = 'button';
  otra.addEventListener('click', () => salir(urlDemo(location.href)));
  const explorar = nodo('button', 'boton-oro presionable pz-final-boton', [bi(CIERRE.explorar)]);
  explorar.type = 'button';
  explorar.addEventListener('click', () => salir());
  // Lo de arriba puede desplazarse en pantallas muy bajas; los botones quedan siempre fijos al pie.
  const cuerpo = nodo('div', 'pz-final-cuerpo', [logo, h, fil, ul, sig, nota]);
  final.append(nodo('div', 'pz-final-panel', [cuerpo, nodo('div', 'pz-final-botones', [otra, explorar])]));
  final.addEventListener('cancel', (e) => { e.preventDefault(); salir(); });
  document.body.append(final);
  return final;
}

export function iniciar() {
  if (document.querySelector('.pz-banda, .pz-escena')) return;
  const marco = enMarco(location.search, window.parent !== window);
  if (!marco && window.top === window && matchMedia(ESCRITORIO).matches) { iniciarEscenario(); return; }
  const escala = escalaDe(location.search);
  const reloj = crearReloj(() => performance.now());
  const escritorio = matchMedia(ESCRITORIO);
  type Estado = 'espera' | 'corre' | 'pausa' | 'final' | 'sale';
  let estado: Estado = 'espera';
  let indice = -1;
  let tPaso = 0;
  let ctrl = new AbortController();
  ponerEstilos();
  html.classList.add('presentando');
  if (marco) html.classList.add('pz-marco');
  try { history.scrollRestoration = 'manual'; } catch { /* nada */ }
  /** Dentro del marco de teléfono: todo lo que se narra va al escenario. */
  const aEscenario = (m: MsgTelefono) => { if (marco) try { parent.postMessage(m, location.origin); } catch { /* nada */ } };

  /* ── Subtítulo: banda de mármol con el paso en versalitas y el filete de avance ── */
  const banda = nodo('section', 'pz-banda');
  banda.setAttribute('popover', 'manual');
  const titulo = nodo('p', 'pz-titulo');
  const linea = nodo('p', 'pz-linea');
  const texto = nodo('div', 'pz-texto', [titulo, linea]);
  const boton = (accion: string, icono: string, es: string, en: string) => {
    const b = nodo('button', 'pz-ctl presionable');
    b.type = 'button';
    b.dataset.pz = accion;
    b.innerHTML = icono;
    b.append(bi({ es, en }, 'sr-only'));
    return b;
  };
  const bPausa = boton('pausa', ICONOS.pausa, 'Pausar', 'Pause');
  const rotuloSeguir = bi({ es: 'Continuar', en: 'Resume' }, 'pz-ctl-rotulo');
  rotuloSeguir.setAttribute('aria-hidden', 'true');
  const bSiguiente = boton('siguiente', ICONOS.siguiente, 'Siguiente paso', 'Next step');
  const bSalir = boton('salir', ICONOS.salir, 'Salir de la presentación', 'Exit the presentation');
  const controles = nodo('div', 'pz-controles', [bPausa, bSiguiente, bSalir]);
  const avance = nodo('span', 'pz-avance');
  const punto = nodo('i', 'pz-punto');
  const filete = nodo('div', 'pz-filete', [nodo('b'), avance, punto]);
  filete.setAttribute('aria-hidden', 'true');
  const vivo = nodo('p', 'sr-only');
  vivo.setAttribute('aria-live', 'polite');
  banda.append(nodo('div', 'pz-fila', [texto, controles]), filete, vivo);

  /* ── Dedo / cursor fantasma ── */
  const cursor = nodo('div', 'pz-cursor');
  cursor.setAttribute('popover', 'manual');
  cursor.setAttribute('aria-hidden', 'true');
  cursor.innerHTML = CURSOR;
  const velo = nodo('div', 'pz-velo');
  velo.setAttribute('popover', 'manual');
  velo.setAttribute('aria-hidden', 'true');
  document.body.append(banda, cursor);

  const mostrar = (el: HTMLElement) => { try { if (el.matches(':popover-open')) el.hidePopover(); el.showPopover(); } catch { /* sin popover: queda en el flujo con z-index */ } };
  mostrar(banda);

  // Un diálogo modal (detalle, Mi pedido) deja inerte todo lo de fuera y se pinta encima: la
  // banda se muda dentro del diálogo abierto (sus botones siguen funcionando) y ambas capas
  // vuelven a ponerse al frente.
  function alzar() {
    if (estado === 'sale') return;
    const abiertos = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].filter((d) => d !== final && (() => { try { return d.matches(':modal'); } catch { return true; } })());
    const padre = abiertos.at(-1) ?? document.body;
    if (banda.parentElement !== padre) padre.append(banda);
    if (estado !== 'final') mostrar(banda);
    mostrar(cursor);
  }
  new MutationObserver(alzar).observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });

  // Alto de la banda (en teléfono la página y la barra superior se recorren para no taparse).
  const medir = () => html.style.setProperty('--pz-alto', `${Math.ceil(banda.getBoundingClientRect().height)}px`);
  if ('ResizeObserver' in window) new ResizeObserver(medir).observe(banda);
  medir();

  function pintarPaso(p: Paso, i: number, animar: boolean) {
    const n = `${i + 1}\u00a0·\u00a0`;
    titulo.replaceChildren(nodo('span', 'pz-num', [n]), bi(p.titulo));
    ponerBi(linea, p.linea.es, p.linea.en);
    banda.dataset.paso = p.id;
    aEscenario({ pz: 'paso', i });
    banda.setAttribute('aria-label', html.lang === 'en' ? 'Presentation' : 'Presentación');
    const es = `Paso ${i + 1} de ${GUION.length}: ${p.titulo.es}. ${p.linea.es}`;
    const en = `Step ${i + 1} of ${GUION.length}: ${p.titulo.en}. ${p.linea.en}`;
    vivo.textContent = html.lang === 'en' ? en : es;
    if (!animar) return;
    for (const el of [titulo, linea]) el.animate(reducir()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(2px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 320, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }

  // Avance continuo (solo transform): el punto de oro recorre el filete.
  let anchoFilete = 0;
  const medirFilete = () => { anchoFilete = filete.getBoundingClientRect().width; };
  if ('ResizeObserver' in window) new ResizeObserver(medirFilete).observe(filete);
  let ultimoAvance = -1;
  function pintarAvance() {
    if (estado === 'sale') return;
    const p = estado === 'final' ? 1 : progreso(GUION, indice, reloj.transcurrido() - tPaso, escala);
    avance.style.transform = `scaleX(${p.toFixed(4)})`;
    punto.style.transform = `translateX(${(p * anchoFilete).toFixed(1)}px)`;
    if (Math.abs(p - ultimoAvance) > 0.0005) { ultimoAvance = p; aEscenario({ pz: 'avance', p }); }
    if (estado !== 'final') requestAnimationFrame(pintarAvance);
  }

  /* ── Esperas que respetan la pausa y el corte ── */
  const verificar = (s: AbortSignal) => { if (s.aborted) throw CORTE; };
  const tic = async (s: AbortSignal) => { await new Promise((r) => setTimeout(r, 40)); verificar(s); };
  async function esperar(ms: number, s: AbortSignal) {
    const fin = reloj.transcurrido() + ms * escala;
    verificar(s);
    while (reloj.transcurrido() < fin) await tic(s);
  }
  /** Espera una condición del producto real (animaciones de la app: tiempo real, sin escalar). */
  async function esperarQue(cond: () => boolean, ms: number, s: AbortSignal) {
    const fin = reloj.transcurrido() + ms;
    while (!cond()) {
      if (reloj.transcurrido() > fin) throw new Fallo('tiempo');
      await tic(s);
    }
  }
  /** Primer elemento visible entre el selector y sus alternativas (espera un poco a que aparezca). */
  async function buscar(sels: string[], s: AbortSignal, ms = 1600): Promise<HTMLElement> {
    let el: HTMLElement | null = null;
    const hallar = () => {
      for (const sel of sels) {
        let lista: HTMLElement[] = [];
        try { lista = [...document.querySelectorAll<HTMLElement>(sel)]; } catch { continue; }
        const v = lista.find(visible);
        if (v) { el = v; return true; }
      }
      return false;
    };
    await esperarQue(hallar, ms, s);
    return el!;
  }
  const existe = (sel: string) => { try { return !!document.querySelector(sel); } catch { return false; } };

  /* ── Cámara: desplazamiento de la página con aceleración y frenado ── */
  async function camara(y: number, ms: number, s: AbortSignal) {
    const max = document.documentElement.scrollHeight - innerHeight;
    const destino = Math.max(0, Math.min(max, Math.round(y)));
    const desde = scrollY;
    if (reducir() || Math.abs(destino - desde) < 2) { scrollTo({ top: destino, behavior: 'instant' }); return; }
    const dur = Math.max(ms * escala, 120);
    const t0 = reloj.transcurrido();
    for (;;) {
      verificar(s);
      const t = Math.min(1, (reloj.transcurrido() - t0) / dur);
      scrollTo({ top: desde + (destino - desde) * suave(t), behavior: 'instant' });
      if (t >= 1) return;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }
  /** Franja libre de la pantalla: debajo de la banda y la barra superior, encima de la isla. */
  function franja() {
    let arriba = 0;
    const nav = document.getElementById('nav');
    if (nav) arriba = Math.max(arriba, nav.getBoundingClientRect().bottom);
    if (!escritorio.matches) arriba = Math.max(arriba, banda.getBoundingClientRect().bottom);
    let abajo = innerHeight;
    const isla = document.querySelector('.isla[data-estado="pildora"] .isla-barra');
    if (isla) abajo = Math.min(abajo, isla.getBoundingClientRect().top);
    if (escritorio.matches) abajo = Math.min(abajo, innerHeight - 12);
    return { arriba: arriba + 8, abajo: abajo - 8 };
  }
  async function aLaVista(el: HTMLElement, s: AbortSignal) {
    const r = el.getBoundingClientRect();
    const enCapa = el.closest('dialog, .isla');
    if (enCapa) {
      if (r.top >= 0 && r.bottom <= innerHeight) return;
      el.scrollIntoView({ block: 'nearest', behavior: reducir() ? 'instant' : 'smooth' });
      await esperar(380, s);
      return;
    }
    const f = franja();
    if (r.top >= f.arriba && r.bottom <= f.abajo) return;
    await camara(scrollY + r.top - (f.arriba + (f.abajo - f.arriba) / 2 - r.height / 2), 700, s);
  }

  /* ── El dedo: se mueve en curva, toca con una onda dorada ── */
  let pos: Punto = { x: innerWidth / 2, y: innerHeight * 0.85 };
  let lado: 1 | -1 = 1;
  let viaje: Animation | null = null;
  let cursorVisible = false;
  const colocar = (p: Punto) => { cursor.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; };
  colocar(pos);
  function verCursor(si: boolean) {
    cursorVisible = si;
    cursor.classList.toggle('ve', si);
  }
  async function terminar(a: Animation, s: AbortSignal) {
    if (reloj.pausado) a.pause();
    const corte = new Promise<never>((_, rej) => s.addEventListener('abort', () => rej(CORTE), { once: true }));
    try { await Promise.race([a.finished, corte]); } catch (e) { a.cancel(); if (e === CORTE) throw e; }
  }
  async function mover(p: Punto, s: AbortSignal) {
    verificar(s);
    if (!cursorVisible) {
      // Entra desde abajo, como un dedo que se acerca a la pantalla.
      pos = { x: Math.min(innerWidth - 24, p.x + 40), y: Math.min(innerHeight + 30, p.y + 180) };
      colocar(pos);
      verCursor(true);
    }
    if (reducir()) {
      // Sin movimiento: se desvanece donde estaba y aparece en el destino.
      await terminar(cursor.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 110, fill: 'forwards' }), s);
      colocar(p);
      await terminar(cursor.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160 }), s);
      pos = p;
      return;
    }
    lado = lado === 1 ? -1 : 1;
    const pts = trayectoria(pos, p, 18, lado);
    viaje = cursor.animate(pts.map((q) => ({ transform: `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)` })), { duration: Math.max(120, duracionMovimiento(pos, p) * escala), easing: 'linear', fill: 'forwards' });
    try { await terminar(viaje, s); } finally { colocar(p); viaje.cancel(); viaje = null; pos = p; }
  }
  function onda() {
    const o = nodo('span', 'pz-onda');
    cursor.append(o);
    const a = reducir()
      ? o.animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' })
      : o.animate([{ opacity: 0.95, transform: 'scale(0.55)' }, { opacity: 0, transform: 'scale(2.3)' }], { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    a.finished.catch(() => undefined).then(() => o.remove());
  }
  const tipoPuntero = () => (matchMedia('(pointer: coarse)').matches ? 'touch' : 'mouse');
  function puntero(el: Element, tipo: string, p: Punto) {
    const ini: PointerEventInit = { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, pointerId: 1, isPrimary: true, pointerType: tipoPuntero(), button: 0, buttons: tipo === 'pointerup' ? 0 : 1 };
    // Un puntero simulado no se puede «capturar» (lanzaría NotFoundError en el teléfono): durante
    // el envío, que es síncrono, capturar y soltar no hacen nada. Los eventos van al mismo control.
    const proto = Element.prototype;
    const { setPointerCapture, releasePointerCapture } = proto;
    proto.setPointerCapture = () => undefined;
    proto.releasePointerCapture = () => undefined;
    try { el.dispatchEvent(new PointerEvent(tipo, ini)); } finally { proto.setPointerCapture = setPointerCapture; proto.releasePointerCapture = releasePointerCapture; }
  }
  function raton(el: Element, tipo: string, p: Punto) {
    el.dispatchEvent(new MouseEvent(tipo, { bubbles: true, cancelable: true, composed: true, clientX: p.x, clientY: p.y, button: 0, buttons: tipo === 'mousedown' ? 1 : 0, detail: 1, view: window }));
  }
  /** Un toque real: pointerdown, mousedown, pointerup, mouseup y click sobre el elemento. */
  async function tocarEl(el: HTMLElement, s: AbortSignal) {
    await aLaVista(el, s);
    const p = centro(el);
    await mover(p, s);
    await esperar(110, s);
    cursor.classList.add('pulsa');
    el.classList.add('pz-pulsa');
    puntero(el, 'pointerdown', p);
    raton(el, 'mousedown', p);
    onda();
    await new Promise((r) => setTimeout(r, 90));
    puntero(el, 'pointerup', p);
    raton(el, 'mouseup', p);
    raton(el, 'click', p);
    setTimeout(() => el.classList.remove('pz-pulsa'), 160);
    await esperar(150, s);
    cursor.classList.remove('pulsa');
  }
  async function escribir(input: HTMLInputElement, txt: string, msLetra: number, s: AbortSignal) {
    const r = input.getBoundingClientRect();
    await mover({ x: r.left + Math.min(r.width - 24, 64), y: r.top + r.height / 2 }, s);
    if (document.activeElement !== input) input.focus({ preventScroll: true });
    input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    for (const ch of txt) {
      await esperar(msLetra, s);
      input.value += ch;
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: ch }));
    }
  }
  /** Deslizar con el dedo: pointerdown, una serie de pointermove y pointerup sobre el control. */
  async function deslizar(el: HTMLElement, dir: -1 | 1, s: AbortSignal) {
    await aLaVista(el, s);
    const r = el.getBoundingClientRect();
    const p0 = { x: r.left + r.width * (dir < 0 ? 0.66 : 0.34), y: r.top + r.height / 2 };
    await mover(p0, s);
    await esperar(120, s);
    const dist = dir * Math.min(140, Math.max(70, r.width * 0.5));
    cursor.classList.add('pulsa');
    let ultimo = p0;
    try {
      puntero(el, 'pointerdown', p0);
      const dur = Math.max(160, 560 * escala);
      const t0 = reloj.transcurrido();
      for (;;) {
        verificar(s);
        const t = Math.min(1, (reloj.transcurrido() - t0) / dur);
        ultimo = { x: p0.x + dist * suave(t), y: p0.y };
        colocar(ultimo);
        puntero(el, 'pointermove', ultimo);
        if (t >= 1) break;
        await new Promise((res) => requestAnimationFrame(res));
      }
      puntero(el, 'pointerup', ultimo);
      raton(el, 'click', ultimo);
    } finally {
      pos = ultimo;
      cursor.classList.remove('pulsa');
    }
  }

  /* ── Cerrar lo que estorba antes de un paso (con los botones reales, sin el dedo) ── */
  const abierto = (sel: string) => !!document.querySelector<HTMLDialogElement>(sel)?.open;
  async function limpiar(tipo: Limpieza, s: AbortSignal) {
    if (tipo === 'nada') return;
    const panel = document.querySelector('.isla-hoja.on');
    if (panel) {
      panel.querySelector<HTMLElement>('[data-isla-cerrar]')?.click();
      await esperarQue(() => !document.querySelector('.isla-hoja.on'), 1500, s).catch(() => undefined);
    }
    if (tipo === 'isla') return;
    if (abierto('#hoja')) {
      document.querySelector<HTMLElement>('#hoja [data-cerrar]')?.click();
      await esperarQue(() => !abierto('#hoja') && !document.querySelector('#morfo:not([hidden])'), 2500, s).catch(() => undefined);
    }
    if (tipo === 'capas' && abierto('#lista')) {
      document.querySelector<HTMLElement>('#lista .pd-x')?.click();
      await esperarQue(() => !abierto('#lista'), 1500, s).catch(() => undefined);
    }
  }

  async function ejecutar(a: Accion, s: AbortSignal) {
    if ('si' in a && a.si && !existe(a.si)) return;
    switch (a.hacer) {
      case 'esperar': await esperar(a.ms, s); return;
      case 'esperarA': await esperarQue(() => existe(a.sel), a.ms, s); return;
      case 'desplazar': {
        const el = await buscar([a.sel], s);
        verCursor(false);
        const r = el.getBoundingClientRect();
        const f = franja();
        const scrollPad = Number.parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
        const y = a.bloque === 'center' ? scrollY + r.top - (f.arriba + (innerHeight - f.arriba) / 2 - r.height / 2) : scrollY + r.top - scrollPad;
        await camara(y, a.ms, s);
        await esperar(a.pausa, s);
        return;
      }
      case 'tocar': {
        const el = await buscar([a.sel, ...(a.alternativas ?? [])], s);
        await tocarEl(el, s);
        await esperar(a.pausa, s);
        return;
      }
      case 'escribir': {
        const el = await buscar([a.sel], s);
        await escribir(el as HTMLInputElement, html.lang === 'en' ? a.texto.en : a.texto.es, a.msLetra, s);
        await esperar(a.pausa, s);
        return;
      }
      case 'deslizar': {
        const el = await buscar([a.sel], s);
        await deslizar(el, a.dir, s);
        await esperar(a.pausa, s);
        return;
      }
    }
  }

  /* ── Recorrido ── */
  async function correr(desde: number) {
    for (let i = desde; i < GUION.length; i++) {
      if (estado === 'sale') return;
      indice = i;
      const paso = GUION[i]!;
      ctrl = new AbortController();
      const s = ctrl.signal;
      tPaso = reloj.transcurrido();
      pintarPaso(paso, i, true);
      try {
        await limpiar(paso.limpia, s);
        await esperar(LECTURA, s);
        for (const a of paso.acciones) {
          try { await ejecutar(a, s); } catch (e) { if (e === CORTE || !('opcional' in a && a.opcional)) throw e; }
        }
      } catch (e) {
        if (e !== CORTE && !(e instanceof Fallo)) console.warn('presentación: paso omitido', paso.id, e);
      }
    }
    if (estado !== 'sale') await cerrarRecorrido();
  }

  function pausar() {
    if (estado !== 'corre') return;
    estado = 'pausa';
    reloj.pausar();
    viaje?.pause();
    banda.dataset.estado = 'pausa';
    aEscenario({ pz: 'estado', pausa: true });
    bPausa.innerHTML = ICONOS.seguir;
    bPausa.append(rotuloSeguir, bi({ es: 'Continuar', en: 'Resume' }, 'sr-only'));
    vivo.textContent = html.lang === 'en' ? 'Presentation paused.' : 'Presentación en pausa.';
  }
  function reanudar() {
    if (estado !== 'pausa') return;
    estado = 'corre';
    reloj.reanudar();
    viaje?.play();
    delete banda.dataset.estado;
    aEscenario({ pz: 'estado', pausa: false });
    bPausa.innerHTML = ICONOS.pausa;
    bPausa.append(bi({ es: 'Pausar', en: 'Pause' }, 'sr-only'));
  }
  function siguiente() {
    if (estado === 'pausa') reanudar();
    if (estado !== 'corre') return;
    ctrl.abort();
  }

  /* ── Tarjeta final (en el marco de teléfono la pone el escenario) ── */
  const final = marco ? null : crearFinal((d) => salir(d));
  async function cerrarRecorrido() {
    const s = new AbortController().signal;
    verCursor(false);
    if (abierto('#lista')) {
      await esperar(300, s);
      document.querySelector<HTMLElement>('#lista .pd-x')?.click();
      await esperarQue(() => !abierto('#lista'), 1500, s).catch(() => undefined);
    }
    await limpiar('capas', s);
    if (estado === 'sale') return;
    estado = 'final';
    indice = GUION.length;
    banda.hidden = true;
    try { banda.hidePopover(); } catch { /* nada */ }
    html.style.setProperty('--pz-alto', '0px');
    vivo.textContent = '';
    aEscenario({ pz: 'avance', p: 1 });
    aEscenario({ pz: 'final' });
    if (!final) return;
    final.showModal();
    final.querySelector<HTMLElement>('.pz-final-titulo')?.focus({ preventScroll: true });
  }

  /* ── Salir: la página se recarga sin ?demo (carrito, seguimiento y mesa reales intactos) ── */
  function salir(destino = urlSinDemo(location.href)) {
    if (estado === 'sale') return;
    // En el marco de teléfono quien sale (y recarga) es el escenario.
    if (marco) { pausar(); aEscenario({ pz: 'salir' }); return; }
    estado = 'sale';
    ctrl.abort();
    viaje?.cancel();
    document.body.append(velo);
    mostrar(velo);
    const ir = () => location.replace(destino);
    if (reducir()) ir();
    else velo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished.then(ir, ir);
  }

  /* ── Controles y gestos de la persona ── */
  controles.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pz]');
    if (!b) return;
    if (b.dataset.pz === 'pausa') { if (estado === 'pausa') reanudar(); else pausar(); }
    else if (b.dataset.pz === 'siguiente') siguiente();
    else if (b.dataset.pz === 'salir') salir();
  });
  const propio = (t: EventTarget | null) => t instanceof Node && (banda.contains(t) || !!final?.contains(t));
  // Órdenes del escenario (solo del mismo origen y de la página que contiene el marco).
  if (marco) addEventListener('message', (e: MessageEvent<MsgEscenario>) => {
    if (e.origin !== location.origin || e.source !== parent || e.data?.pz !== 'ctl') return;
    const a = e.data.accion;
    if (a === 'pausa') pausar();
    else if (a === 'seguir') reanudar();
    else if (a === 'siguiente') siguiente();
    else if (a === 'salir') aEscenario({ pz: 'salir' });
  });
  let tragarHasta = 0;
  // Un toque real sobre la página pausa (y ese toque no activa lo que hay debajo).
  addEventListener('pointerdown', (e) => {
    if (!e.isTrusted || estado !== 'corre' || propio(e.target)) return;
    pausar();
    tragarHasta = performance.now() + 900;
  }, { capture: true });
  addEventListener('click', (e) => {
    if (e.isTrusted && performance.now() < tragarHasta && !propio(e.target)) {
      tragarHasta = 0;
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Nunca se abre WhatsApp, una llamada ni un mapa externo.
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (a && esEnlaceExterno(a.getAttribute('href') ?? '')) {
      e.preventDefault();
      if (e.isTrusted) avisar('En la presentación no se abre WhatsApp ni el teléfono.', 'WhatsApp and calls don’t open during the presentation.');
    }
  }, { capture: true });
  addEventListener('wheel', (e) => { if (e.isTrusted && estado === 'corre') pausar(); }, { capture: true, passive: true });
  addEventListener('touchmove', (e) => { if (e.isTrusted && estado === 'corre' && !propio(e.target)) pausar(); }, { capture: true, passive: true });
  window.open = () => null;
  addEventListener('keydown', (e) => {
    if (estado === 'sale') return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); salir(); return; }
    if (estado === 'final' || estado === 'espera') return;
    const t = e.target as HTMLElement | null;
    if (t?.closest?.('input, textarea, select, [contenteditable="true"]') && estado === 'pausa') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); e.stopImmediatePropagation(); siguiente(); }
    else if (e.key === ' ' && !propio(t)) { e.preventDefault(); e.stopImmediatePropagation(); if (estado === 'pausa') reanudar(); else pausar(); }
  }, { capture: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pausar(); });
  // El idioma puede cambiar a media demostración: el anuncio se rehace en el nuevo.
  new MutationObserver(() => {
    aEscenario({ pz: 'lang', lang: html.lang });
    if (indice >= 0 && indice < GUION.length) pintarPaso(GUION[indice]!, indice, false);
  }).observe(html, { attributes: true, attributeFilter: ['lang'] });

  /* ── Arranque: espera a que termine la animación de inicio ── */
  (async () => {
    scrollTo({ top: 0, behavior: 'instant' });
    const s = ctrl.signal;
    const t0 = performance.now();
    while (html.classList.contains('intro') && performance.now() - t0 < 9000) await new Promise((r) => setTimeout(r, 80));
    if ((estado as Estado) === 'sale') return;
    banda.classList.add('entra');
    estado = 'corre';
    tPaso = reloj.transcurrido();
    indice = 0;
    pintarPaso(GUION[0]!, 0, false);
    requestAnimationFrame(pintarAvance);
    // Si piden «siguiente» antes de que arranque el primer paso, se empieza por el segundo.
    let desde = 0;
    try { await esperar(250, s); } catch { desde = 1; }
    await correr(desde);
  })();
}

/* ═══════════════════════  ESCENARIO (COMPUTADORA)  ═══════════════════════
   El menú se enseña como lo verán los comensales: en un teléfono. Al lado, la narración en letra
   grande (se lee a un par de metros, en una laptop o un proyector), el índice de los 9 pasos y
   los controles. La página de abajo queda oculta; su estado real no se toca (?demo=1 la aísla). */
function iniciarEscenario() {
  ponerEstilos();
  html.classList.add('presentando', 'pz-escenario');
  try { history.scrollRestoration = 'manual'; } catch { /* nada */ }
  let estado: 'corre' | 'pausa' | 'final' | 'sale' = 'corre';
  let indice = 0;

  /* ── El teléfono: bisel negro con filete de oro; dentro, el sitio real a 390×844 ── */
  const pantalla = document.createElement('iframe');
  pantalla.className = 'pz-pantalla';
  pantalla.src = urlMarco(location.href);
  pantalla.width = String(TELEFONO.w);
  pantalla.height = String(TELEFONO.h);
  pantalla.title = html.lang === 'en' ? 'MAKIZEN menu on a phone (demo)' : 'Menú de MAKIZEN en un teléfono (demostración)';
  const telefono = nodo('div', 'pz-telefono', [pantalla]);
  const hueco = nodo('div', 'pz-telefono-hueco', [telefono]);
  const escalar = () => {
    const s = escalaTelefono({ w: innerWidth, h: innerHeight });
    hueco.style.setProperty('--s', s.toFixed(4));
  };
  escalar();
  addEventListener('resize', escalar);

  /* ── La narración ── */
  const rotulo = nodo('p', 'pz-relato-rotulo', [bi({ es: 'Así lo ven tus clientes', en: 'What your guests see' })]);
  const cuenta = nodo('p', 'pz-relato-cuenta');
  const titulo = nodo('h1', 'pz-relato-titulo');
  const linea = nodo('p', 'pz-relato-linea');
  const avance = nodo('span', 'pz-avance');
  const punto = nodo('i', 'pz-punto');
  const filete = nodo('div', 'pz-filete pz-relato-filete', [nodo('b'), avance, punto]);
  filete.setAttribute('aria-hidden', 'true');
  const indiceLista = nodo('ol', 'pz-indice', GUION.map((p, i) => { const li = nodo('li', '', [nodo('span', 'pz-indice-n', [String(i + 1)]), bi(p.titulo)]); li.dataset.i = String(i); return li; }));
  const boton = (accion: string, icono: string, t: Txt) => {
    const b = nodo('button', 'pz-ctl pz-ctl-texto presionable');
    b.type = 'button';
    b.dataset.pz = accion;
    b.innerHTML = icono;
    b.append(bi(t, 'pz-ctl-rotulo'));
    return b;
  };
  const bPausa = boton('pausa', ICONOS.pausa, { es: 'Pausar', en: 'Pause' });
  const bSiguiente = boton('siguiente', ICONOS.siguiente, { es: 'Siguiente', en: 'Next' });
  const bSalir = boton('salir', ICONOS.salir, { es: 'Salir', en: 'Exit' });
  const controles = nodo('div', 'pz-controles pz-relato-controles', [bPausa, bSiguiente, bSalir]);
  const vivo = nodo('p', 'sr-only');
  vivo.setAttribute('aria-live', 'polite');
  const relato = nodo('section', 'pz-relato', [rotulo, cuenta, titulo, linea, filete, controles, indiceLista, vivo]);
  relato.setAttribute('aria-label', html.lang === 'en' ? 'Presentation' : 'Presentación');
  const escena = nodo('div', 'pz-escena', [hueco, relato]);
  const velo = nodo('div', 'pz-velo');
  velo.setAttribute('aria-hidden', 'true');
  document.body.append(escena);
  const final = crearFinal((d) => salir(d));

  function pintar(i: number, animar: boolean) {
    const p = GUION[i];
    if (!p) return;
    indice = i;
    relato.dataset.paso = p.id;
    cuenta.replaceChildren(bi({ es: `Paso ${i + 1} de ${GUION.length}`, en: `Step ${i + 1} of ${GUION.length}` }));
    titulo.replaceChildren(bi(p.titulo));
    ponerBi(linea, p.linea.es, p.linea.en);
    indiceLista.querySelectorAll('li').forEach((li, k) => { li.dataset.estado = k < i ? 'hecho' : k === i ? 'ahora' : ''; if (k === i) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
    vivo.textContent = html.lang === 'en' ? `Step ${i + 1} of ${GUION.length}: ${p.titulo.en}. ${p.linea.en}` : `Paso ${i + 1} de ${GUION.length}: ${p.titulo.es}. ${p.linea.es}`;
    if (!animar) return;
    [titulo, linea].forEach((el, k) => el.animate(reducir()
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(3px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }],
    { duration: 420, delay: k * 70, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' }));
  }
  pintar(0, false);
  relato.classList.add('espera');

  let anchoFilete = filete.getBoundingClientRect().width;
  if ('ResizeObserver' in window) new ResizeObserver(() => { anchoFilete = filete.getBoundingClientRect().width; }).observe(filete);
  const pintarAvance = (p: number) => {
    avance.style.transform = `scaleX(${p.toFixed(4)})`;
    punto.style.transform = `translateX(${(p * anchoFilete).toFixed(1)}px)`;
  };
  pintarAvance(0);

  function enPausa(si: boolean) {
    if (estado === 'final' || estado === 'sale') return;
    estado = si ? 'pausa' : 'corre';
    if (si) relato.dataset.estado = 'pausa'; else delete relato.dataset.estado;
    bPausa.innerHTML = si ? ICONOS.seguir : ICONOS.pausa;
    bPausa.append(bi(si ? { es: 'Continuar', en: 'Resume' } : { es: 'Pausar', en: 'Pause' }, 'pz-ctl-rotulo'));
    if (si) vivo.textContent = html.lang === 'en' ? 'Presentation paused.' : 'Presentación en pausa.';
  }
  const mandar = (accion: MsgEscenario['accion']) => { try { pantalla.contentWindow?.postMessage({ pz: 'ctl', accion } satisfies MsgEscenario, location.origin); } catch { /* nada */ } };

  addEventListener('message', (e: MessageEvent<MsgTelefono>) => {
    if (e.origin !== location.origin || e.source !== pantalla.contentWindow || !e.data || typeof e.data !== 'object') return;
    const m = e.data;
    if (m.pz === 'paso') { if (relato.classList.contains('espera')) relato.classList.remove('espera'); pintar(m.i, m.i !== indice || !relato.dataset.vio); relato.dataset.vio = '1'; }
    else if (m.pz === 'avance') pintarAvance(m.p);
    else if (m.pz === 'estado') enPausa(m.pausa);
    else if (m.pz === 'lang' && (m.lang === 'es' || m.lang === 'en')) { html.lang = m.lang; pintar(indice, false); }
    else if (m.pz === 'salir') salir();
    else if (m.pz === 'final') {
      if (estado === 'sale') return;
      estado = 'final';
      pintarAvance(1);
      indiceLista.querySelectorAll('li').forEach((li) => { li.dataset.estado = 'hecho'; li.removeAttribute('aria-current'); });
      final.showModal();
      final.querySelector<HTMLElement>('.pz-final-titulo')?.focus({ preventScroll: true });
      vivo.textContent = '';
    }
  });

  controles.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-pz]');
    if (!b) return;
    if (b.dataset.pz === 'pausa') { const pausar = estado !== 'pausa'; enPausa(pausar); mandar(pausar ? 'pausa' : 'seguir'); }
    else if (b.dataset.pz === 'siguiente') { if (estado === 'pausa') enPausa(false); mandar('siguiente'); }
    else if (b.dataset.pz === 'salir') salir();
  });
  addEventListener('keydown', (e) => {
    if (estado === 'sale') return;
    if (e.key === 'Escape') { e.preventDefault(); salir(); return; }
    if (estado === 'final') return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); if (estado === 'pausa') enPausa(false); mandar('siguiente'); }
    else if (e.key === ' ' && !(e.target as Element | null)?.closest?.('button')) { e.preventDefault(); const pausar = estado !== 'pausa'; enPausa(pausar); mandar(pausar ? 'pausa' : 'seguir'); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && estado === 'corre') { enPausa(true); mandar('pausa'); } });
  window.open = () => null;

  function salir(destino = urlSinDemo(location.href)) {
    if (estado === 'sale') return;
    estado = 'sale';
    mandar('pausa');
    document.body.append(velo);
    try { velo.setAttribute('popover', 'manual'); velo.showPopover(); } catch { /* nada */ }
    const ir = () => location.replace(destino);
    if (reducir()) ir();
    else velo.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, easing: 'ease-out', fill: 'forwards' }).finished.then(ir, ir);
  }
}
