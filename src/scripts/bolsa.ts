// La bolsa de «Mi pedido» (isla y barra superior), el vuelo de lo agregado y el aviso «Agregado».
// Coreografía (≈ 900 ms, una sola por cada platillo agregado):
//  1 · El botón confirma (lo pinta quien llama) y se reserva el contador: lo visible conserva
//      el número anterior mientras el platillo viaja.
//  2 · La miniatura sale de donde se ve el platillo y viaja en arco con su estela (morfo.ts).
//      Cerca del final la bolsa abre la boca (animación programada en el mismo reloj).
//  3 · Al entrar: la bolsa cierra y se aplasta, sale una onda, el contador rueda solo lo que
//      trajo ese vuelo (con varios seguidos cuenta 1, 2, 3…) y aparece el aviso con «Ver pedido».
// Nada depende de temporizadores: todo encadena promesas de animaciones (Web Animations), que
// también se resuelven si el vuelo se interrumpe (terminar()). El texto real del contador
// (textContent) siempre es el número vigente; lo visible se pinta con ::before/::after desde
// data-antes/data-vista (el lector de pantalla usa la etiqueta del botón).
import { contadorVisible } from '../lib/detalle';
import { reducir } from './comun';
import { aLaBolsa, aterrizarVuelos, type Caja, type Forma_Vuelo } from './morfo';

/** `listaEn`: ms que faltan para que la bolsa termine de formarse (la isla que aparece). */
export type Destino = { caja: Caja; el: HTMLElement; listaEn?: number };
export type Origen = { src: string; a: number; caja: Caja; forma: Forma_Vuelo };

const contadores = () => [...document.querySelectorAll<HTMLElement>('.isla-lista .contador, #nav .nav-contador')];
/** Último número real del pedido; piezas que van volando (aún no visibles); reservas abiertas. */
let real = 0;
let enVuelo = 0;
let retenido = 0;
/** Hasta cuándo no se muestra el aviso «Agregado» (se está abriendo el pedido). */
let silencioHasta = 0;

/** Pone el número real en un contador. Lo visible espera a los platillos que van en camino. */
export function ponerContador(el: HTMLElement, n: number) {
  real = n;
  el.textContent = contadorVisible(n);
  // La primera vez (al cargar la página con un pedido guardado) no rueda.
  if (!retenido) pintarVista(el, el.dataset.listo === '1');
  el.dataset.listo = '1';
}

function pintarVista(el: HTMLElement, rodar: boolean) {
  const nuevo = contadorVisible(Math.max(0, real - enVuelo));
  const antes = el.dataset.vista ?? nuevo;
  el.dataset.vista = nuevo;
  el.dataset.antes = antes;
  // El de la barra superior desaparece en cero (y vuelve a entrar con un pequeño salto).
  if (el.hasAttribute('data-ocultar-cero')) el.hidden = nuevo === '0';
  if (antes === nuevo) return;
  el.classList.remove('rueda', 'baja');
  if (!rodar || reducir()) return;
  const sube = Number.parseInt(nuevo, 10) >= Number.parseInt(antes, 10) || antes === '';
  void el.offsetWidth;
  el.classList.add('rueda');
  el.classList.toggle('baja', !sube);
}
const repintar = (rodar: boolean) => contadores().forEach((c) => pintarVista(c, rodar));

export type Reserva = { confirmar: () => number; cancelar: () => void; llegar: () => void };
/**
 * Antes de agregar: congela lo visible del contador. Tras agregar, `confirmar()` mide cuántas
 * piezas entraron de verdad (puede ser menos de las pedidas por el tope de 20) y las deja «en
 * vuelo»; `llegar()` las muestra con el odómetro. `cancelar()` si no se agregó nada.
 */
export function reservar(): Reserva {
  const antes = real;
  retenido++;
  let delta = 0;
  let estado: 'reservada' | 'volando' | 'lista' = 'reservada';
  const r: Reserva = {
    confirmar() {
      if (estado !== 'reservada') return delta;
      retenido--;
      delta = Math.max(0, real - antes);
      enVuelo += delta;
      estado = 'volando';
      repintar(false);
      return delta;
    },
    cancelar() {
      if (estado !== 'reservada') return;
      retenido--;
      estado = 'lista';
      repintar(false);
    },
    llegar() {
      if (estado === 'reservada') r.confirmar();
      if (estado !== 'volando') return;
      estado = 'lista';
      enVuelo = Math.max(0, enVuelo - delta);
      repintar(true);
    },
  };
  return r;
}

/* ── La bolsa abre la boca y recibe ─────────────────────────────────── */
const TAPA_ABIERTA = 'rotate(-26deg) translate(-0.6px, -1.2px)';
type Estado = { entrantes: number; boca?: Animation | undefined; golpe: Animation[] };
const bolsas = new WeakMap<HTMLElement, Estado>();
const estadoDe = (el: HTMLElement) => { let e = bolsas.get(el); if (!e) { e = { entrantes: 0, golpe: [] }; bolsas.set(el, e); } return e; };

/** Programa que la bolsa abra la boca justo antes de que llegue la miniatura (mismo reloj del vuelo). */
function abrirBoca(el: HTMLElement, enMs: number) {
  const e = estadoDe(el);
  e.entrantes++;
  const tapa = el.querySelector<SVGGElement>('.bolsa-tapa');
  if (!tapa || reducir() || e.boca) return;
  e.boca = tapa.animate([{ transform: 'none' }, { transform: TAPA_ABIERTA }], { duration: 160, delay: Math.max(0, enMs), easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' });
}

/** La miniatura entró: la bolsa cierra (si no viene otra), se aplasta y sale una onda. */
function recibir(el: HTMLElement) {
  const e = estadoDe(el);
  e.entrantes = Math.max(0, e.entrantes - 1);
  if (reducir()) return;
  const tapa = el.querySelector<SVGGElement>('.bolsa-tapa');
  if (tapa && e.entrantes === 0 && e.boca) {
    const progreso = e.boca.effect?.getComputedTiming().progress;
    const abierta = progreso !== null && progreso !== undefined && progreso > 0;
    e.boca.cancel();
    e.boca = undefined;
    if (abierta) tapa.animate([{ transform: TAPA_ABIERTA }, { transform: 'rotate(5deg)', offset: 0.45 }, { transform: 'none' }], { duration: 340, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' });
  }
  // Un solo golpe a la vez: si llegan seguidas, el nuevo reemplaza al anterior (sin acumular).
  e.golpe.forEach((a) => a.cancel());
  e.golpe = [];
  const ico = el.querySelector<SVGElement>('.bolsa-ico');
  if (ico) e.golpe.push(ico.animate(
    [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.16, 0.82)', offset: 0.25 }, { transform: 'scale(0.95, 1.07)', offset: 0.6 }, { transform: 'scale(1, 1)' }],
    { duration: 340, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  ));
  const onda = el.querySelector<HTMLElement>('.bolsa-onda');
  if (onda) e.golpe.push(onda.animate([{ transform: 'scale(0.75)', opacity: 0.9 }, { transform: 'scale(1.8)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }));
}

/**
 * Lleva lo agregado a la bolsa. Sin destino, sin origen o con movimiento reducido no hay vuelo:
 * el contador cambia y el aviso aparece en el mismo cuadro. `alLlegar` corre una sola vez.
 */
export async function llevarALaBolsa(o: { reserva: Reserva; destino: Destino | null; origen: Origen | null; alLlegar: () => void; seguir?: () => Destino | null }) {
  const { reserva, destino, origen } = o;
  if (!destino || !origen || reducir()) {
    reserva.llegar();
    o.alLlegar();
    return;
  }
  const seguir = o.seguir;
  const vuelo = aLaBolsa(origen.src, origen.a, origen.caja, destino.caja, origen.forma, {
    seguir: seguir ? () => { const d = seguir(); return d && d.el === destino.el ? d.caja : null; } : undefined,
    listaEn: destino.listaEn,
  });
  // La boca termina de abrirse justo cuando llega la miniatura.
  abrirBoca(destino.el, vuelo.dur - 170);
  await vuelo.llego;
  reserva.llegar();
  recibir(destino.el);
  o.alLlegar();
}

// Si la persona abre el pedido, cambia de pestaña o gira la pantalla, lo que va en el aire llega ya.
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (ev) => {
    if (!(ev.target as Element | null)?.closest?.('[data-abrir-lista], .bolsa-boton, .aa-ver')) return;
    // Va a abrir el pedido: lo que vuela llega ya y no hace falta avisar «Agregado» (se vería un instante).
    silencioHasta = performance.now() + 700;
    aterrizarVuelos();
  }, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) aterrizarVuelos(); });
  // Solo si cambia el ancho (girar la pantalla): en el teléfono la barra del navegador cambia el
  // alto al desplazarse y eso no debe cortar el vuelo (la bolsa se sigue con «seguir»).
  let ancho = innerWidth;
  addEventListener('resize', () => { if (innerWidth !== ancho) { ancho = innerWidth; aterrizarVuelos(); } });
}

/* ── Aviso «Agregado · Ver pedido» ──────────────────────────────────── */
let tAviso = 0;
let yAviso = 0;
let ultimo: { id: string; n: number } | null = null;
const DURA_AVISO = 2600;

function ponerNombre(el: Element, n: number, nombre: { es: string; en: string }) {
  // Nodos de texto: nada de innerHTML (el nombre viene del menú, igual se trata como texto).
  const pieza = (lang: string, t: string) => { const s = document.createElement('span'); s.lang = lang; s.textContent = n > 1 ? `${n} × ${t}` : t; return s; };
  el.replaceChildren(pieza('es', nombre.es), pieza('en', nombre.en));
}

export function avisarAgregado(o: { id: string; nombre: { es: string; en: string }; foto?: string | undefined; n: number; abrirPedido: () => void; bolsa?: HTMLElement | null | undefined }) {
  const caja = document.getElementById('aviso-agregado');
  // Con otro diálogo abierto (Mi pedido) no se avisa; la hoja que se está cerrando tras agregar no cuenta.
  if (!caja || o.n <= 0 || performance.now() < silencioHasta || document.querySelector('dialog[open]:not([data-saliendo])') || document.documentElement.classList.contains('isla-abierta')) return;
  const visible = !caja.hidden && !caja.classList.contains('sale');
  // Varios del mismo platillo seguidos se suman en el mismo aviso («3 × Corona»).
  const n = visible && ultimo?.id === o.id ? ultimo.n + o.n : o.n;
  const cambia = !visible || ultimo?.id !== o.id;
  ultimo = { id: o.id, n };
  const img = caja.querySelector<HTMLImageElement>('.aa-mini img');
  if (img && cambia) { if (o.foto) { img.src = o.foto; img.hidden = false; } else img.hidden = true; }
  const nombre = caja.querySelector('.aa-nombre');
  if (nombre) ponerNombre(nombre, n, o.nombre);
  const boton = caja.querySelector<HTMLButtonElement>('.aa-ver')!;
  boton.onclick = () => { ocultarAviso(true); o.abrirPedido(); };
  yAviso = scrollY;
  clearTimeout(tAviso);
  tAviso = window.setTimeout(() => ocultarAviso(), DURA_AVISO);
  if (visible) {
    // Ya estaba a la vista: no vuelve a entrar (sin parpadeo); solo el texto se actualiza con un pulso.
    if (!reducir()) caja.querySelector('.aa-texto')?.animate([{ opacity: 0.35, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    return;
  }
  // Nace de la bolsa que lo recibió: el origen de la escala apunta hacia ella.
  caja.hidden = false;
  caja.classList.remove('sale', 'entra');
  const b = o.bolsa?.getBoundingClientRect();
  const r = caja.getBoundingClientRect();
  caja.style.setProperty('--aa-ox', b && b.width ? `${Math.round(Math.min(r.width, Math.max(0, b.left + b.width / 2 - r.left)))}px` : '50%');
  caja.style.setProperty('--aa-oy', b && b.width && b.top < r.top ? '0%' : '100%');
  void caja.offsetWidth;
  caja.classList.add('entra');
}

export function ocultarAviso(inmediato = false) {
  const caja = document.getElementById('aviso-agregado');
  if (!caja || caja.hidden) return;
  clearTimeout(tAviso);
  const fin = () => { caja.hidden = true; caja.classList.remove('sale', 'entra'); ultimo = null; };
  if (inmediato || reducir()) { fin(); return; }
  // Si el foco estaba en «Ver pedido», no se pierde al desaparecer el aviso.
  if (caja.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  caja.classList.add('sale');
  tAviso = window.setTimeout(fin, 200);
}

/** Mientras el cursor o el foco están en el aviso, no se va. */
export function prepararAviso() {
  const caja = document.getElementById('aviso-agregado');
  if (!caja) return;
  const pausar = () => clearTimeout(tAviso);
  const seguir = () => { clearTimeout(tAviso); tAviso = window.setTimeout(() => ocultarAviso(), 1800); };
  caja.addEventListener('pointerenter', pausar);
  caja.addEventListener('pointerleave', seguir);
  caja.addEventListener('focusin', pausar);
  caja.addEventListener('focusout', seguir);
  // Al seguir recorriendo el menú, el aviso se retira para no tapar los platillos.
  addEventListener('scroll', () => {
    if (caja.hidden || caja.classList.contains('sale') || caja.contains(document.activeElement)) return;
    if (Math.abs(scrollY - yAviso) > 90) ocultarAviso();
  }, { passive: true });
}
