// Guía del comensal: «pistas en el momento» (interfaz). Se carga aparte (import dinámico desde
// app.ts, al terminar la intro y con el navegador libre). Qué pista toca y cuándo: src/lib/guia.ts.
//
//  · Pistas flotantes (bienvenida de mesa, isla, pedido, agregar, buscar): una tarjeta pequeña
//    de mármol con filete dorado, un ensō que se pinta y un hilo de oro con el punto del logo que
//    toca lo que explica. Nunca dos a la vez; se van solas, al tocarlas, con Escape o al usar la
//    función. No son modales: el foco no se mueve y el resto de la página sigue tocable.
//  · Realces en su lugar (la primera vez): filtros de la búsqueda, el botón Agregar de la hoja y
//    una línea en la comanda de «Mi pedido».
//  · «¿Prueba el Camarón Roca?»: empujón de primera visita, en la página, al final de la portada.
//  · «¿Cómo pido?»: hoja con los 4 pasos y «Ver las pistas otra vez».
// Todo el texto entra como nodos (textContent), nunca innerHTML con datos.
import '../styles/guia.css';
import { arcoEnso, trazoEnso } from '../lib/detalle';
import {
  apagarEnSesion, CLAVE, CLAVE_APAGADA, colocar, DURACION_MS, encolar, estadoVacio, guiaActiva, leerEstado, marcar, marcarBienvenida,
  prepararBienvenida, reiniciar, serializar, siguiente, textoPista, tocaBienvenida, tocaBusqueda, visto,
  type Caja, type Cola, type Estado, type GuiaId, type Lado, type Pista,
} from '../lib/guia';
import { precio, usd } from '../lib/precios';
import { $, $$, datos, esIngles, html, ponerBi, reducir } from './comun';

/* ── Estado: localStorage; si falla, sessionStorage; si también falla, solo memoria ── */
let estado: Estado = estadoVacio();
function cargarEstado() {
  const ahora = Date.now();
  try { estado = leerEstado(localStorage.getItem(CLAVE), ahora); return; } catch { /* sigue */ }
  try { estado = leerEstado(sessionStorage.getItem(CLAVE), ahora); } catch { /* memoria */ }
}
function guardarEstado() {
  const s = serializar(estado);
  try { localStorage.setItem(CLAVE, s); return; } catch { /* sigue */ }
  try { sessionStorage.setItem(CLAVE, s); } catch { /* queda en memoria: no se repite en esta visita */ }
}
const ver = (id: GuiaId) => { if (visto(estado, id)) return; estado = marcar(estado, id, Date.now()); guardarEstado(); };
const leerSesion = (k: string) => { try { return sessionStorage.getItem(k); } catch { return null; } };

/* ── Utilidades de DOM ── */
const NS = 'http://www.w3.org/2000/svg';
function nodo<K extends keyof HTMLElementTagNameMap>(tag: K, clase = '', hijos: (Node | string)[] = []) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  n.append(...hijos);
  return n;
}
function bi(tag: keyof HTMLElementTagNameMap, clase: string, es: string, en: string) { const n = nodo(tag, clase); ponerBi(n, es, en); return n; }
function svg(tag: string, attrs: Record<string, string>) { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; }
const cajaDe = (el: Element): Caja => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
const visible = (c: Caja) => c.w > 0 && c.h > 0 && c.y + c.h > 0 && c.y < innerHeight && c.x + c.w > 0 && c.x < innerWidth;

/** Ensō de pincel (el mismo trazo del detalle del platillo), revelado por una máscara que recorre el arco. */
const TRAZO = trazoEnso();
const ARCO = arcoEnso();
const PUNTO = (() => { const g = (101 * Math.PI) / 180; return { x: (100 + 84 * Math.cos(g)).toFixed(1), y: (100 + 84 * Math.sin(g)).toFixed(1) }; })();
let nEnso = 0;
function enso(clase: string) {
  const id = `gp-${++nEnso}`;
  const s = svg('svg', { viewBox: '0 0 200 200', class: clase, 'aria-hidden': 'true', focusable: 'false' });
  const defs = svg('defs', {});
  const grad = svg('linearGradient', { id: `${id}-oro`, x1: '0', y1: '0', x2: '1', y2: '1' });
  for (const [o, c] of [['0', '#ecd598'], ['0.45', '#ae8b3d'], ['0.8', '#d2b26a'], ['1', '#8a6d2f']]) grad.append(svg('stop', { offset: o!, 'stop-color': c! }));
  const mask = svg('mask', { id: `${id}-m`, maskUnits: 'userSpaceOnUse', x: '-10', y: '-10', width: '220', height: '220' });
  mask.append(svg('path', { class: 'gp-enso-guia', d: ARCO, pathLength: '100' }));
  defs.append(grad, mask);
  s.append(defs, svg('path', { class: 'gp-enso-trazo', d: TRAZO, mask: `url(#${id}-m)`, fill: `url(#${id}-oro)` }), svg('circle', { class: 'gp-enso-punto', cx: PUNTO.x, cy: PUNTO.y, r: '9' }));
  return s;
}

/* ── Región viva propia (cortés): las pistas se anuncian sin mover el foco ── */
// Se crea al iniciar la guía (vacía): algunos lectores de pantalla ignoran una región viva que se
// inserta y se llena en el mismo instante.
let vivo: HTMLElement | null = null;
function regionViva() {
  if (!vivo) { vivo = nodo('p', 'sr-only'); vivo.id = 'guia-anuncio'; vivo.setAttribute('aria-live', 'polite'); document.body.append(vivo); }
  return vivo;
}
function anunciar(t: string) {
  const r = regionViva();
  r.textContent = '';
  requestAnimationFrame(() => (r.textContent = t));
}

/* ── Contexto de la página ── */
const mesaQR = () => {
  if (leerSesion('makizen-mesa-qr') !== '1') return null;
  const n = Number(leerSesion('makizen-mesa'));
  return Number.isInteger(n) && n >= 1 && n <= 99 ? n : null;
};
const tactil = () => matchMedia('(pointer: coarse)').matches;
const piezas = () => Number($('#nav .nav-contador')?.textContent ?? '0') || 0;
const ocupada = () => html.classList.contains('intro') || html.classList.contains('isla-abierta') || html.classList.contains('bloqueo') || !!document.querySelector('dialog[open]') || document.hidden;
const islaVisible = () => $('#isla')?.dataset.estado === 'pildora';

/* ═════════════════════════════  PISTAS FLOTANTES  ═════════════════════════════ */
/** `caja`: lo que la pista no debe tapar; `foco`: lo que se rodea con el anillo (si no, la caja). */
type Ancla = { caja: Caja; foco?: Caja; fija: boolean; lado: Lado; alinear?: 'centro' | 'inicio' | 'fin'; radio: string; el: Element };
type Visible = { id: Pista; el: HTMLElement; extras: Element[]; cerrar: (motivo: string) => void };
let activo = false;
let cola: Cola = [];
let actual: Visible | null = null;
let ultimaTermino = -Infinity;

/** Dónde se ancla cada pista en este momento (o null si su ancla no está a la vista). */
function ancla(id: Pista): Ancla | null {
  if (id === 'isla' || id === 'busqueda') {
    if (!islaVisible()) return null;
    const el = $(id === 'isla' ? '.isla-pildora' : '.isla-lupa');
    if (!el) return null;
    const caja = cajaDe(el);
    return visible(caja) ? { caja, fija: true, lado: 'arriba', alinear: id === 'isla' ? 'inicio' : 'fin', radio: id === 'isla' ? '26px' : '50%', el } : null;
  }
  if (id === 'pedido') {
    const el = $('#nav [data-abrir-lista]');
    if (!el) return null;
    const caja = cajaDe(el);
    return visible(caja) ? { caja, fija: true, lado: 'abajo', alinear: 'fin', radio: '999px', el } : null;
  }
  if (id === 'agregar') {
    // La primera tarjeta de la carta que se ve completa y deja sitio debajo para la pista.
    // La pista va debajo de la tarjeta completa (no tapa ni la foto ni el nombre ni el precio).
    const tope = 76; const piso = innerHeight - 150;
    const candidatos = (productos.size ? [...productos] : $$('#menu [data-seccion] article.producto')) as HTMLElement[];
    const orden = candidatos.map((art) => ({ art, c: cajaDe(art) })).sort((a, b) => a.c.y - b.c.y || a.c.x - b.c.x);
    for (const { art, c } of orden) {
      const mas = art.querySelector<HTMLElement>('[data-agregar]');
      const el = mas ?? art.querySelector<HTMLElement>('.producto-marco');
      if (!el || c.y < tope || c.y + c.h > piso) continue;
      return { caja: c, foco: cajaDe(el), fija: false, lado: 'abajo', radio: mas ? '50%' : '22px', el };
    }
    return null;
  }
  return null;
}

function tarjeta(id: Pista): HTMLElement {
  const ctx = { mesa: mesaQR(), tactil: tactil() };
  const es = textoPista(id, 'es', ctx);
  const en = textoPista(id, 'en', ctx);
  const el = nodo('div', `gp gp-${id}`);
  el.dataset.pista = id;
  // Lo que dice ya lo anuncia la región viva: la tarjeta es su versión visible.
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--dura', `${DURACION_MS[id]}ms`);
  const texto = nodo('p', 'gp-texto', [bi('span', 'gp-titulo', es.titulo, en.titulo), bi('span', 'gp-detalle', es.detalle, en.detalle)]);
  if (id === 'bienvenida') {
    const num = nodo('span', 'gp-num', [String(ctx.mesa ?? '')]);
    el.append(nodo('span', 'gp-sello', [enso('gp-enso'), num]), texto);
  } else {
    el.append(enso('gp-enso'), texto, nodo('span', 'gp-hilo'));
  }
  el.append(nodo('span', 'gp-tiempo'));
  return el;
}

/** Anillo de oro que respira una vez alrededor de lo que se explica (no capta toques). */
function anillo(a: Ancla) {
  const r = nodo('span', 'gp-anillo');
  const c = a.foco ?? a.caja;
  Object.assign(r.style, {
    position: a.fija ? 'fixed' : 'absolute',
    left: `${c.x + (a.fija ? 0 : scrollX) - 4}px`, top: `${c.y + (a.fija ? 0 : scrollY) - 4}px`,
    width: `${c.w + 8}px`, height: `${c.h + 8}px`, borderRadius: a.radio,
  });
  document.body.append(r);
  return r;
}

/** El gesto de deslizar dibujado sobre la píldora: el punto de oro va y viene con su estela. */
function gesto(pildora: Element) {
  const t = pildora.querySelector('.isla-texto') ?? pildora;
  const c = cajaDe(t);
  const g = nodo('span', 'gp-gesto', [nodo('span', 'gp-gesto-flecha gp-izq'), nodo('span', 'gp-gesto-punto'), nodo('span', 'gp-gesto-flecha gp-der')]);
  Object.assign(g.style, { left: `${c.x}px`, top: `${c.y}px`, width: `${c.w}px`, height: `${c.h}px` });
  document.body.append(g);
  // El nombre de la sección se asoma hacia donde va la yema (translate: no choca con el arrastre real, que usa transform).
  if (!reducir() && t !== pildora) {
    const a = (t as HTMLElement).animate(
      [{ translate: '0', opacity: 1 }, { translate: '0', offset: 0.12 }, { translate: '-9px', opacity: 0.7, offset: 0.42 }, { translate: '-9px', offset: 0.52 }, { translate: '9px', opacity: 0.7, offset: 0.88 }, { translate: '0', opacity: 1 }],
      { duration: 1800, delay: 450, iterations: 2, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
    );
    pildora.addEventListener('pointerdown', () => a.cancel(), { once: true });
    new MutationObserver((_, mo) => { if (!g.isConnected) { a.cancel(); mo.disconnect(); } }).observe(document.body, { childList: true });
  }
  return g;
}

function mostrar(id: Pista): boolean {
  const mesa = mesaQR();
  if (id === 'bienvenida' && mesa === null) return false;
  const a = id === 'bienvenida' ? null : ancla(id);
  if (id !== 'bienvenida' && !a) return false;
  const el = tarjeta(id);
  el.style.visibility = 'hidden';
  document.body.append(el);
  const tam = { w: el.offsetWidth, h: el.offsetHeight };
  if (id === 'bienvenida') {
    const nav = $('#nav')?.getBoundingClientRect();
    el.style.left = `${Math.round((innerWidth - tam.w) / 2)}px`;
    el.style.top = `${Math.round((nav?.bottom ?? 64) + 10)}px`;
  } else if (a) {
    const p = colocar({ ancla: a.caja, tam, vista: { w: innerWidth, h: innerHeight }, lado: a.lado, alinear: a.alinear, hueco: 18 });
    el.dataset.lado = p.lado;
    el.style.position = a.fija ? 'fixed' : 'absolute';
    el.style.left = `${p.x + (a.fija ? 0 : scrollX)}px`;
    el.style.top = `${p.y + (a.fija ? 0 : scrollY)}px`;
    el.style.setProperty('--hilo', `${p.hilo}px`);
    // La tarjeta crece desde el lado que mira a su ancla.
    el.style.transformOrigin = `${p.hilo}px ${p.lado === 'arriba' ? '100%' : '0%'}`;
  }
  el.style.visibility = '';
  el.classList.add('entra');

  const extras: Element[] = [];
  if (a && id !== 'isla') extras.push(anillo(a));
  if (a && id === 'isla') extras.push(gesto(a.el));
  if (id === 'pedido') {
    const onda = a?.el.querySelector<HTMLElement>('.bolsa-onda');
    if (onda && !reducir()) onda.animate([{ transform: 'scale(0.8)', opacity: 0.9 }, { transform: 'scale(1.9)', opacity: 0 }], { duration: 900, iterations: 2, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  }

  // Marcada al mostrarse: no vuelve aunque se recargue a la mitad.
  if (id === 'bienvenida') { estado = marcarBienvenida(estado, mesa!, Date.now()); guardarEstado(); } else ver(id);
  const t = textoPista(id, esIngles() ? 'en' : 'es', { mesa, tactil: tactil() });
  anunciar(`${t.titulo}. ${t.detalle}.`);

  // Se va sola (el tiempo se detiene mientras el cursor está encima), al tocarla o al usar la función.
  let restante = DURACION_MS[id];
  let desde = performance.now();
  let reloj = window.setTimeout(() => cerrar('tiempo'), restante);
  const pausar = () => { clearTimeout(reloj); restante -= performance.now() - desde; el.classList.add('pausa'); };
  const seguir = () => { desde = performance.now(); el.classList.remove('pausa'); reloj = window.setTimeout(() => cerrar('tiempo'), Math.max(800, restante)); };
  el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pausar(); });
  el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') seguir(); });
  el.addEventListener('pointerdown', () => cerrar('toque'));
  const y0 = scrollY;
  const alDesplazar = () => { if (a && !a.fija && Math.abs(scrollY - y0) > innerHeight * 0.6) cerrar('lejos'); };
  addEventListener('scroll', alDesplazar, { passive: true });

  let hecho = false;
  function cerrar(_motivo: string) {
    if (hecho) return;
    hecho = true;
    clearTimeout(reloj);
    removeEventListener('scroll', alDesplazar);
    el.classList.remove('entra');
    el.classList.add('sale');
    for (const x of extras) x.classList.add('sale');
    const quitar = () => { el.remove(); extras.forEach((x) => x.remove()); };
    // Con movimiento reducido también hay fundido (solo opacidad, ver guia.css).
    window.setTimeout(quitar, 220);
    if (actual?.el === el) actual = null;
    ultimaTermino = Date.now();
    bombear();
  }
  actual = { id, el, extras, cerrar };
  return true;
}

let tBomba = 0;
let pedidoAlFinal = false;
/** Saca la siguiente pista si toca; si quedan en espera, vuelve a mirar en un momento. */
function bombear() {
  clearTimeout(tBomba);
  if (!activo) return;
  for (;;) {
    const r = siguiente(cola, Date.now(), { e: estado, actual: actual?.id ?? null, ocupada: ocupada(), ultimaTermino });
    cola = r.cola;
    if (!r.id) break;
    // Si su ancla no está a la vista, se descarta: su disparador la volverá a pedir.
    if (mostrar(r.id)) break;
  }
  // Tras «Ver las pistas otra vez» con platillos ya en el carrito: su pista cierra el recorrido.
  if (pedidoAlFinal && !actual && !cola.length) { pedidoAlFinal = false; pedir('pedido'); return; }
  if (cola.length) tBomba = window.setTimeout(bombear, 450);
}
function pedir(id: Pista) {
  if (!activo) return;
  cola = encolar(cola, id, Date.now(), estado, actual?.id ?? null);
  bombear();
}
/** La persona ya usó la función: la pista se da por vista (y si está a la vista, se va). */
function usar(id: Pista) {
  if (actual?.id === id) actual.cerrar('uso');
  ver(id);
  cola = cola.filter((x) => x.id !== id);
}

/* ═════════════════════════════  REALCES EN SU LUGAR  ═════════════════════════════ */
/** Filtros de la búsqueda: un brillo de oro los recorre la primera vez que se abre. */
function realzarFiltros() {
  if (visto(estado, 'filtros')) return;
  const f = $('.isla-filtros');
  if (!f) return;
  ver('filtros');
  f.classList.add('guia-filtros');
  window.setTimeout(() => f.classList.remove('guia-filtros'), 2200);
}

/**
 * Hoja del platillo, la primera vez. Sin sabores: «Agregar» respira en oro. Con sabor por elegir:
 * las opciones brillan cuando asoman (suelen quedar más abajo) y «Agregar» despierta en cuanto se
 * elige uno: el realce marca el paso siguiente, nunca invita a tocar un botón que aún no sirve.
 */
function realzarHoja() {
  if (visto(estado, 'hoja')) return;
  const hoja = $<HTMLDialogElement>('#hoja');
  const boton = $('#hoja-agregar');
  if (!hoja?.open || !boton || boton.hidden) return;
  ver('hoja');
  const opciones = $('#hoja-opciones');
  const limpiar: (() => void)[] = [];
  const realce = () => {
    boton.classList.remove('guia-realce');
    void boton.offsetWidth;
    boton.classList.add('guia-realce');
    const t = window.setTimeout(() => boton.classList.remove('guia-realce'), 3400);
    limpiar.push(() => { clearTimeout(t); boton.classList.remove('guia-realce'); });
  };
  if (opciones) {
    const io = new IntersectionObserver(([e]) => {
      if (!e?.isIntersecting) return;
      io.disconnect();
      opciones.classList.add('guia-elige');
      const t = window.setTimeout(() => opciones.classList.remove('guia-elige'), 2000);
      limpiar.push(() => { clearTimeout(t); opciones.classList.remove('guia-elige'); });
    }, { threshold: 0.6 });
    io.observe(opciones);
    const alElegir = (e: Event) => { if ((e.target as Element).matches('input[name="hoja-op"]')) { opciones.removeEventListener('change', alElegir); realce(); } };
    opciones.addEventListener('change', alElegir);
    limpiar.push(() => { io.disconnect(); opciones.removeEventListener('change', alElegir); });
  } else {
    const t = window.setTimeout(realce, 450);
    limpiar.push(() => clearTimeout(t));
  }
  hoja.addEventListener('close', () => limpiar.forEach((f) => f()), { once: true });
}

/** «Mi pedido» la primera vez: una línea bajo los pasos que nombra el recorrido (sin crear scroll). */
function lineaPasos(paso: string | undefined) {
  if (visto(estado, 'pasos') || paso !== '1') return;
  const dlg = $<HTMLDialogElement>('#lista');
  const linea = $('#pd-guia-pasos');
  if (!dlg || !linea) return;
  ver('pasos');
  linea.hidden = false;
  dlg.classList.add('guia-pasos');
  dlg.addEventListener('close', () => { linea.hidden = true; dlg.classList.remove('guia-pasos'); }, { once: true });
}

/* ═══════════════════  EMPUJÓN DE PRIMERA VISITA: EL CAMARÓN ROCA  ═══════════════════ */
const RECOMENDADO = 'camaron-roca';
function insertarCamaron() {
  if (visto(estado, 'camaron') || piezas() > 0 || $('.gc')) return;
  const p = datos.platillos.find((x) => x.id === RECOMENDADO);
  const centinela = $('#centinela');
  if (!p || p.agotado || !centinela) return;
  // Solo si su lugar está por debajo de la pantalla: aparecer nunca mueve lo que se está viendo.
  if (centinela.getBoundingClientRect().top < innerHeight + 40) return;

  // Sin foto real del platillo: se usa la ilustración dorada de su categoría (no se inventa una foto).
  const img = document.createElement('img');
  img.src = datos.iconos[p.catId] ?? '/brand/isotipo.svg';
  img.alt = ''; img.width = 64; img.height = 64; img.decoding = 'async';
  img.dataset.foto = p.id;
  img.className = 'gc-img';
  const mini = nodo('span', 'gc-mini', [enso('gc-enso'), img]);
  mini.setAttribute('aria-hidden', 'true');

  const rotulo = bi('p', 'gc-rotulo', '¿Primera vez?', 'First time?');
  const abrir = nodo('button', 'gc-abrir');
  abrir.type = 'button';
  abrir.dataset.abrir = p.id;
  abrir.setAttribute('aria-haspopup', 'dialog');
  ponerBi(abrir, `Prueba el ${p.nombre.es}`, `Try the ${p.nombre.en}`);
  const titulo = nodo('h2', 'gc-titulo', [abrir]);
  titulo.id = 'gc-t';
  const detalle = bi('p', 'gc-detalle', 'Lo que más elogian en las reseñas', 'The one reviews rave about');
  const monto = nodo('p', 'gc-precio', [precio(p.precio), ' ', nodo('small', '', [usd(p.precio, datos.tc)])]);

  const mas = svg('svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.4', 'stroke-linecap': 'round', 'aria-hidden': 'true' });
  mas.append(svg('path', { d: 'M6 12h12M12 6v12' }));
  const etiqueta = bi('span', '', 'Agregar', 'Add');
  const quien = bi('span', 'sr-only', ` ${p.nombre.es} a mi pedido`, ` ${p.nombre.en} to my order`);
  const agregar = nodo('button', 'gc-agregar presionable', [mas, etiqueta, quien]);
  agregar.type = 'button';
  agregar.dataset.agregar = p.id;

  const xs = svg('svg', { viewBox: '0 0 24 24', width: '20', height: '20', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'aria-hidden': 'true' });
  xs.append(svg('path', { d: 'M7 7l10 10M17 7 7 17' }));
  const cerrar = nodo('button', 'gc-x presionable', [xs, bi('span', 'sr-only', 'Quitar la sugerencia', 'Dismiss the suggestion')]);
  cerrar.type = 'button';

  const art = nodo('article', 'gc', [mini, nodo('div', 'gc-texto', [rotulo, titulo, detalle]), nodo('div', 'gc-pie', [monto, agregar]), cerrar]);
  art.setAttribute('aria-labelledby', 'gc-t');
  const envoltura = nodo('div', 'contenedor gc-envoltura', [art]);
  centinela.after(envoltura);
  ver('camaron');

  // Entra al asomar: el ensō se pinta alrededor del platillo y el texto sube.
  const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { art.classList.add('visto'); io.disconnect(); } }, { threshold: 0.35 });
  io.observe(art);

  // Agregar en un toque: lo hace el clic de [data-agregar] en app.ts (vuelo a la bolsa incluido).
  // Aquí solo se confirma en la tarjeta, cuando el platillo ya llegó al carrito.
  agregar.addEventListener('click', () => {
    const antes = piezas();
    window.setTimeout(() => {
      if (piezas() <= antes) return;
      usar('agregar');
      window.setTimeout(() => confirmar(), reducir() ? 0 : 950);
    }, 0);
  });
  function confirmar() {
    art.dataset.estado = 'agregado';
    ponerBi(rotulo, '¡Buena elección!', 'Great pick!');
    ponerBi(abrir, p!.nombre.es, p!.nombre.en);
    ponerBi(detalle, 'Ya está en tu pedido', "It's in your order");
    const verPedido = nodo('button', 'gc-agregar gc-ver presionable');
    verPedido.type = 'button';
    verPedido.dataset.abrirLista = '';
    ponerBi(verPedido, 'Ver pedido', 'View order');
    const enfocado = document.activeElement === agregar;
    agregar.replaceWith(verPedido);
    if (enfocado) verPedido.focus({ preventScroll: true });
  }
  cerrar.addEventListener('click', () => {
    const quitar = () => envoltura.remove();
    if (reducir()) { quitar(); return; }
    const h = envoltura.offsetHeight;
    envoltura.style.overflow = 'hidden';
    envoltura.animate([{ height: `${h}px`, opacity: 1 }, { height: '0px', opacity: 0, paddingTop: '0px' }], { duration: 260, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }).finished.then(quitar, quitar);
  });
}

/* ═════════════════════════════  DISPARADORES  ═════════════════════════════ */
let armada = false;
let cambios = 0;
let msConIsla = 0;
let islaDesde = 0;
const productos = new Set<Element>();

function armar() {
  if (armada) return;
  armada = true;

  // Bienvenida de mesa (llegaron por el QR): en cuanto termina la intro.
  const mesa = mesaQR();
  estado = prepararBienvenida(estado, mesa);
  if (tocaBienvenida(estado, mesa)) pedir('bienvenida');

  // Isla: su pista sale cuando aparece por primera vez; buscar, cuando ya se explora.
  const isla = $('#isla');
  const alCambiarIsla = () => {
    if (islaVisible()) {
      if (!islaDesde) islaDesde = performance.now();
      if (!visto(estado, 'isla')) window.setTimeout(() => { if (islaVisible()) pedir('isla'); }, 700);
    } else {
      if (islaDesde) { msConIsla += performance.now() - islaDesde; islaDesde = 0; }
      if (actual && (actual.id === 'isla' || actual.id === 'busqueda')) actual.cerrar('oculta');
    }
  };
  if (isla) new MutationObserver(alCambiarIsla).observe(isla, { attributes: true, attributeFilter: ['data-estado'] });
  alCambiarIsla();
  const num = $('.isla-pildora .num');
  if (num) new MutationObserver(() => { if (islaVisible()) { cambios++; revisarBusqueda(); } }).observe(num, { childList: true, characterData: true, subtree: true });
  window.setInterval(revisarBusqueda, 2000);

  // Tarjetas de la carta a la vista → pista de agregar.
  const io = new IntersectionObserver((es) => {
    for (const e of es) { if (e.isIntersecting) productos.add(e.target); else productos.delete(e.target); }
    if (productos.size && !visto(estado, 'agregar')) pedir('agregar');
  }, { threshold: 0.9 });
  $$('#menu [data-seccion] article.producto').forEach((a) => io.observe(a));

  // Primer platillo en el carrito: cuando termina el vuelo (el contador visible cambia) y se va el aviso «Agregado».
  const contador = $('#nav .nav-contador');
  let antes = Number(contador?.dataset.vista ?? '0') || 0;
  if (contador) new MutationObserver(() => {
    const ahora = Number(contador.dataset.vista ?? '0') || 0;
    if (antes === 0 && ahora > 0 && !visto(estado, 'pedido')) trasAviso(() => pedir('pedido'));
    antes = ahora;
  }).observe(contador, { attributes: true, attributeFilter: ['data-vista'] });

  // Uso de cada función (captura: llega antes que el clic que la abre).
  document.addEventListener('pointerdown', (ev) => {
    const t = ev.target as Element | null;
    if (!t?.closest) return;
    if (t.closest('.isla-pildora')) usar('isla');
    else if (t.closest('.isla-lupa')) usar('busqueda');
    else if (t.closest('[data-abrir-lista], .aa-ver')) usar('pedido');
    else if (t.closest('#menu article.producto, [data-agregar]')) usar('agregar');
  }, { capture: true, passive: true });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && actual) actual.cerrar('escape');
    if ((ev.key === 'Enter' || ev.key === ' ') && (ev.target as Element | null)?.closest?.('.isla-pildora')) usar('isla');
  });

  // Realces: búsqueda abierta, hoja del platillo lista, Mi pedido abierto.
  const busca = $('#isla-busca');
  if (busca) new MutationObserver(() => { if (busca.classList.contains('on')) realzarFiltros(); }).observe(busca, { attributes: true, attributeFilter: ['class'] });
  const hoja = $('#hoja');
  if (hoja) new MutationObserver(() => { if (hoja.classList.contains('panel-listo')) { usar('agregar'); realzarHoja(); } }).observe(hoja, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('makizen:lista-abre', (ev) => lineaPasos((ev as CustomEvent<{ paso?: string }>).detail?.paso));

  // Algo abre un panel o un diálogo (o vuelve a estar libre): la pista a la vista se va; la cola espera.
  new MutationObserver(() => { if (actual && ocupada()) actual.cerrar('ocupada'); bombear(); }).observe(html, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', () => { if (document.hidden && actual) actual.cerrar('oculta'); bombear(); });
  // Solo si cambia el ancho (girar): en el teléfono la barra del navegador cambia el alto al desplazarse.
  let ancho = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ancho) { ancho = innerWidth; actual?.cerrar('giro'); } });
  // Otra pestaña ya vio una pista: no se repite aquí.
  addEventListener('storage', (e) => { if (e.key === CLAVE) estado = leerEstado(e.newValue, Date.now()); });

  insertarCamaron();
}

function revisarBusqueda() {
  if (!activo || visto(estado, 'busqueda')) return;
  const ms = msConIsla + (islaDesde ? performance.now() - islaDesde : 0);
  if (tocaBusqueda({ islaVista: visto(estado, 'isla'), cambios, msConIsla: ms }) && islaVisible()) pedir('busqueda');
}

/** Espera a que se vaya el aviso «Agregado · Ver pedido» (como mucho 4 s) para no encimar dos avisos. */
function trasAviso(fn: () => void) {
  const aviso = $('#aviso-agregado');
  let listo = false;
  let mo: MutationObserver | null = null;
  const ir = () => { if (listo) return; listo = true; mo?.disconnect(); window.setTimeout(fn, 250); };
  // El aviso aparece en el mismo cuadro en que cambia el contador: se mira un instante después.
  window.setTimeout(() => {
    if (!aviso || aviso.hidden) { ir(); return; }
    mo = new MutationObserver(() => { if (aviso.hidden) ir(); });
    mo.observe(aviso, { attributes: true, attributeFilter: ['hidden'] });
    window.setTimeout(ir, 4000);
  }, 120);
}

/** Tras «Ver las pistas otra vez»: todo vuelve a empezar desde lo que ya está a la vista. */
function rearmar() {
  cola = [];
  actual?.cerrar('reinicio');
  cambios = 0; msConIsla = 0; islaDesde = islaVisible() ? performance.now() : 0;
  if (!armada) { armar(); return; }
  const mesa = mesaQR();
  if (tocaBienvenida(estado, mesa)) pedir('bienvenida');
  // Un respiro tras cerrar la hoja; luego, en el orden natural: primero lo que se tiene delante
  // (isla, tarjetas) y al final el carrito, aunque ya tenga platillos (si no, por prioridad, se adelantaría).
  window.setTimeout(() => {
    if (islaVisible()) pedir('isla');
    if (productos.size) pedir('agregar');
    pedidoAlFinal = piezas() > 0;
    bombear();
  }, 500);
  insertarCamaron();
}

/* ═════════════════════════════  «¿CÓMO PIDO?»  ═════════════════════════════ */
let comoArmado = false;
let disparador: HTMLElement | null = null;
function armarComoPido(dlg: HTMLDialogElement) {
  if (comoArmado) return;
  comoArmado = true;
  const cerrar = async () => {
    if (!dlg.open) return;
    if (!reducir()) {
      dlg.classList.add('cerrando');
      await new Promise((r) => window.setTimeout(r, 200));
      dlg.classList.remove('cerrando');
    }
    dlg.close();
  };
  dlg.addEventListener('close', () => {
    dlg.classList.remove('entra');
    if (!document.querySelector('dialog[open]')) html.classList.remove('bloqueo');
    // El foco vuelve a quien abrió la hoja; si quedó dentro de un panel cerrado, a la sección actual.
    const d = disparador;
    const destino = d && d.isConnected && !d.closest('[inert]') ? d : $('.isla-pildora:not([inert])') ?? $('#t-menu');
    destino?.focus({ preventScroll: true });
    bombear();
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); void cerrar(); });
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dlg || t.closest('[data-cp-cerrar]')) { void cerrar(); return; }
    if (t.closest('[data-cp-reiniciar]')) {
      estado = reiniciar(estado);
      guardarEstado();
      try { sessionStorage.removeItem(CLAVE_APAGADA); } catch { /* nada */ }
      activo = guiaActiva(location.search);
      void cerrar().then(() => {
        anunciar(esIngles() ? 'Done: the tips will show again as you go.' : 'Listo: las pistas volverán a salir mientras recorres el menú.');
        if (activo) rearmar();
      });
    }
  });
}

export function abrirComoPido(desde?: HTMLElement | null) {
  const dlg = $<HTMLDialogElement>('#como-pido');
  if (!dlg || dlg.open) return;
  armarComoPido(dlg);
  actual?.cerrar('ocupada');
  disparador = desde ?? null;
  dlg.classList.remove('cerrando');
  dlg.showModal();
  html.classList.add('bloqueo');
  void dlg.offsetWidth;
  dlg.classList.add('entra');
  $<HTMLElement>('#cp-titulo', dlg)?.focus({ preventScroll: true });
}

/* ═════════════════════════════  INICIO  ═════════════════════════════ */
let iniciada = false;
export function iniciarGuia() {
  if (iniciada) return;
  iniciada = true;
  regionViva();
  const ap = apagarEnSesion(location.search);
  try { if (ap === true) sessionStorage.setItem(CLAVE_APAGADA, '1'); else if (ap === false) sessionStorage.removeItem(CLAVE_APAGADA); } catch { /* nada */ }
  cargarEstado();
  activo = guiaActiva(location.search, leerSesion(CLAVE_APAGADA) === '1');
  if (!activo) return;
  armar();
  bombear();
}
