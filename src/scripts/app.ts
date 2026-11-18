// Interacción del menú. Sin librerías: Web Animations API, IntersectionObserver,
// CSS scroll-driven, transiciones de transform/opacity para la isla y clip-path + FLIP para el detalle.
// Este archivo solo conecta los módulos: idioma, estado del local, isla, hoja y lista.
import { etiquetaPedido } from '../lib/detalle';
import { precio } from '../lib/precios';
import { normalizar } from '../lib/texto';
import { avisarAgregado, llevarALaBolsa, ocultarAviso, ponerContador, prepararAviso, reservar, type Destino } from './bolsa';
import { $, $$, datos, guardar, html, miniRecorte, reducir } from './comun';
import { pintarEstado } from './estado';
import { crearHoja } from './hoja';
import { crearIsla } from './isla';
import { crearLista } from './lista';
import { cajaDe, proporcion, rectImagen } from './morfo';

/* ── Idioma ───────────────────────────────────────────────────────── */
let objetivo = html.lang;
const enRutaMenu = () => location.pathname === '/' || location.pathname === '/en/' || location.pathname === '/en';
function aplicarIdioma() {
  const en = html.lang === 'en';
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lang === 'en') === en)));
  const input = $<HTMLInputElement>('#buscar');
  if (input) { input.placeholder = en ? 'Search…' : 'Buscar…'; input.setAttribute('aria-label', en ? 'Search the menu' : 'Buscar en el menú'); }
  const t = en ? html.dataset.tituloEn : html.dataset.tituloEs;
  if (t) document.title = t;
  pintarEstado();
  hoja.idioma();
  lista.pintar();
  etiquetaNav();
  isla.idioma();
  requestAnimationFrame(() => espiar());
}
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]');
  if (!b) return;
  const nuevo = b.dataset.lang === 'en' ? 'en' : 'es-MX';
  if (objetivo === nuevo) return;
  objetivo = nuevo;
  guardar.escribir('makizen-idioma', nuevo === 'en' ? 'en' : 'es');
  // La dirección refleja el idioma (/ o /en/) para compartir el enlace correcto.
  if (enRutaMenu()) history.replaceState(history.state, '', (nuevo === 'en' ? '/en/' : '/') + location.hash);
  const cambiar = () => { html.lang = objetivo; aplicarIdioma(); };
  if (!document.startViewTransition || reducir()) { cambiar(); return; }
  html.classList.add('cambia-idioma');
  document.startViewTransition(cambiar).finished.finally(() => html.classList.remove('cambia-idioma'));
});

/* ── Barra superior: sólida al salir de la portada ─────────────────── */
// Un centinela a 24 px del inicio en lugar de leer scrollY en cada evento de scroll.
const nav = $('#nav')!;
const tope = document.createElement('div');
tope.setAttribute('aria-hidden', 'true');
tope.style.cssText = 'position:absolute;top:24px;left:0;width:1px;height:1px;pointer-events:none';
document.body.prepend(tope);
new IntersectionObserver(([e]) => { if (e) nav.classList.toggle('solida', !e.isIntersecting && e.boundingClientRect.top < 0); }).observe(tope);

/* ── Movimiento sin fin solo cuando se ve ──────────────────────────── */
// La cinta, la ola, el destello del logo y el punto «abierto» se pausan fuera de pantalla
// (data-pausa, ver src/styles/intro.css) y con la pestaña oculta.
const vigia = new IntersectionObserver((es) => es.forEach((e) => e.target.toggleAttribute('data-pausa', !e.isIntersecting)), { rootMargin: '120px 0px' });
$$('#inicio, [data-estado-local]').forEach((el) => vigia.observe(el));
document.addEventListener('visibilitychange', () => html.toggleAttribute('data-pausa', document.hidden));

/* ── Aparición al hacer scroll ─────────────────────────────────────── */
// En cuanto asoma 1 px. El escalonado (--r) es solo entre lo que entra a la vez; lo que ya está bien
// dentro de la pantalla al detectarse (salto a una categoría, scroll rápido, volver hacia arriba)
// se muestra al instante (.ya). La primera pantalla al cargar sí entra con su animación.
const arranque = performance.now();
const revela = new IntersectionObserver((entradas) => {
  const alto = innerHeight;
  const portada = scrollY < 40 && performance.now() - arranque < 2500;
  let k = 0;
  for (const e of entradas) {
    if (!e.isIntersecting) continue;
    const el = e.target as HTMLElement;
    revela.unobserve(el);
    if (!portada && (alto - e.boundingClientRect.top > alto * 0.25 || reducir())) el.classList.add('ya');
    else el.style.setProperty('--r', String(k++));
    el.classList.add('visto');
  }
}, { threshold: 0 });
$$('.revela, .cortina').forEach((el) => revela.observe(el));

// Imágenes del menú. Relleno provisional (LQIP en línea) hasta que la imagen está decodificada.
const sinRelleno = (img: HTMLImageElement) => { img.decode().catch(() => {}).then(() => img.setAttribute('data-cargada', '')); };
$$<HTMLImageElement>('img.lqip').forEach((img) => {
  if (img.complete && img.naturalWidth) sinRelleno(img);
  else img.addEventListener('load', () => sinRelleno(img), { once: true });
});
// Se piden antes de hacer falta: la sección que está a poco más de una pantalla, la categoría que se toca
// (pointerdown llega antes que el clic y el desplazamiento) y la del enlace #categoría.
let ultimoPedido = 0;
const pedir = (raiz: Element | null | undefined) => {
  if (!raiz) return;
  ultimoPedido = performance.now();
  $$<HTMLImageElement>('img.lqip[loading="lazy"]', raiz as HTMLElement).forEach((img) => { img.loading = 'eager'; });
};
// Más hacia abajo (hacia donde se avanza) que hacia arriba, para no competir con lo que se ve.
const cerca = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { pedir(e.target); cerca.unobserve(e.target); } }), { rootMargin: '25% 0px 120% 0px' });
$$('section').filter((s) => s.querySelector('img.lqip')).forEach((s) => cerca.observe(s));
const pedirCategoria = (id: string | undefined) => { const s = id ? document.getElementById(id) : null; if (s?.matches('section')) { pedir(s); pedir(s.nextElementSibling); } };
const alTocar = (ev: Event) => {
  const t = ev.target as HTMLElement;
  pedirCategoria(t.closest<HTMLElement>('[data-ir]')?.dataset.ir);
  // En pantallas de densidad 1–2 la tarjeta usa una variante; el detalle usa el original: se adelanta.
  const img = t.closest('article.producto')?.querySelector<HTMLImageElement>('img.lqip[srcset]');
  if (img?.currentSrc && img.currentSrc !== img.src) new Image().src = img.src;
};
document.addEventListener('pointerdown', alTocar, { capture: true, passive: true });
document.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') alTocar(ev); }, { capture: true, passive: true });
addEventListener('hashchange', () => pedirCategoria(decodeURIComponent(location.hash.slice(1))));
pedirCategoria(decodeURIComponent(location.hash.slice(1)));
// Con la página ya quieta, el resto de los platillos se descarga de uno en uno, del más cercano al
// más lejano, para que un salto a cualquier categoría se vea al instante (no con ahorro de datos ni 2G).
const red = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
if (!red?.saveData && !/2g/.test(red?.effectiveType ?? '')) {
  const ocioso = () => new Promise<void>((r) => ('requestIdleCallback' in window ? requestIdleCallback(() => r(), { timeout: 2000 }) : setTimeout(r, 200)));
  const calentar = async () => {
    const y = innerHeight / 2;
    const cola = $$<HTMLImageElement>('article.producto img.lqip[loading="lazy"]')
      .map((img) => ({ img, d: Math.abs(img.getBoundingClientRect().top - y) }))
      .sort((a, b) => a.d - b.d);
    for (const { img } of cola) {
      if (img.complete || img.loading === 'eager') continue;
      // Cede la red a lo que pide la persona (salto, sección cercana) mientras ocurre.
      while (performance.now() - ultimoPedido < 1500) await new Promise((r) => setTimeout(r, 300));
      await ocioso();
      img.loading = 'eager';
      await new Promise<void>((r) => { img.addEventListener('load', () => r(), { once: true }); img.addEventListener('error', () => r(), { once: true }); setTimeout(r, 5000); });
    }
  };
  const empezar = () => setTimeout(calentar, 2000);
  if (document.readyState === 'complete') empezar(); else addEventListener('load', empezar, { once: true });
}

/* ── Categorías: isla, índice lateral y categoría activa ───────────── */
const secciones = $$('[data-seccion]');
/** Mientras dura un salto elegido por la persona, el espía no corrige la categoría activa. */
let bloqueo = 0;
let llegada: Animation | null = null;
function ir(id: string) {
  const sec = document.getElementById(id);
  if (!sec) return;
  const i = datos.cats.findIndex((c) => c.id === id);
  isla.actualizar(i, i >= isla.indice ? 1 : -1);
  $$('.revela, .cortina', sec).forEach((el) => el.classList.add('visto'));
  history.replaceState(history.state, '', `#${id}`);
  // Cerca (menos de ~1 pantalla): desplazamiento suave y corto. Lejos: salto instantáneo y una
  // llegada breve de la sección (fundido + 16 px, solo transform/opacity). Antes se recorría toda
  // la carta con scroll suave: un segundo o más pintando tarjetas que nadie veía, con tirones.
  const cerca = Math.abs(sec.getBoundingClientRect().top - 80) < innerHeight * 1.1;
  const suave = cerca && !reducir();
  bloqueo = performance.now() + (suave ? 1200 : 250);
  sec.scrollIntoView({ behavior: suave ? 'smooth' : 'instant', block: 'start' });
  if (suave) addEventListener('scrollend', () => { bloqueo = performance.now() + 120; }, { once: true });
  if (!suave && !reducir()) {
    llegada?.cancel();
    llegada = sec.animate(
      [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }],
      { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
  // Destello del título (sin forzar un reflow para reiniciar la animación).
  sec.classList.remove('llega');
  requestAnimationFrame(() => sec.classList.add('llega'));
  clearTimeout(Number(sec.dataset.tLlega));
  sec.dataset.tLlega = String(window.setTimeout(() => sec.classList.remove('llega'), 1300));
}

const isla = crearIsla({
  cats: datos.cats,
  platillos: datos.platillos.map((p) => ({
    id: p.id, nombre: p.nombre, cat: p.cat, precio: precio(p.precio), foto: p.foto, icono: datos.iconos[p.catId] ?? '/brand/isotipo.svg',
    texto: normalizar([p.nombre.es, p.nombre.en, p.descripcion?.es ?? '', p.descripcion?.en ?? '', p.cat.es, p.cat.en].join(' ')),
    favorito: p.etiquetas.includes('favorito'), picante: p.picante, crudo: p.crudo, agotado: p.agotado,
    comida: datos.cats.findIndex((c) => c.id === p.catId) < datos.cats.findIndex((c) => c.id === 'mixologia'),
  })),
  ir,
  abrir: (id) => hoja.abrir(id, null),
  abrirLista: () => { ocultarAviso(true); isla.cerrar(false); lista.abrir(); },
  reducir,
});

// Categoría activa: la última sección que toca la franja superior (0–40 % de la pantalla).
// Solo IntersectionObserver: el navegador avisa cuando una sección entra o sale de la franja
// (también tras un salto instantáneo) y aquí se guarda ese estado; nunca se lee el layout.
const enFranja = new Set<number>();
const pasada = secciones.map(() => false);
function espiar() {
  if (performance.now() < bloqueo) return;
  let i = -1;
  enFranja.forEach((k) => { if (k > i) i = k; });
  // Fuera de toda sección: arriba de la carta → la primera; debajo (Visita) → la última pasada.
  if (i < 0) i = pasada.lastIndexOf(true);
  const nuevo = Math.max(0, i);
  if (nuevo !== isla.indice) isla.actualizar(nuevo, nuevo > isla.indice ? 1 : -1);
}
const cruce = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    const k = secciones.indexOf(e.target as HTMLElement);
    if (e.isIntersecting) enFranja.add(k); else enFranja.delete(k);
    pasada[k] = !e.isIntersecting && e.boundingClientRect.top < 0;
  }
  espiar();
}, { rootMargin: '0px 0px -60% 0px' });
secciones.forEach((s) => cruce.observe(s));

/* ── Mi pedido ─────────────────────────────────────────────────────── */
let enMenu = false;
let piezasLista = 0;
let totalLista = 0;
const visibilidad = () => isla.mostrar(enMenu || piezasLista > 0);
function etiquetaNav() {
  const txt = etiquetaPedido(piezasLista, precio(totalLista), html.lang === 'en' ? 'en' : 'es');
  $$('#nav [data-abrir-lista]').forEach((b) => b.setAttribute('aria-label', txt));
}
const lista = crearLista({
  alCambiar: (n, total) => {
    piezasLista = n;
    totalLista = total;
    isla.contar(n, precio(total));
    $$('[data-contador-lista]').forEach((el) => { ponerContador(el, n); if (!el.hasAttribute('data-ocultar-cero')) el.hidden = n === 0; });
    etiquetaNav();
    visibilidad();
  },
});
// La isla aparece al llegar al menú, o siempre que el pedido tenga algo.
new IntersectionObserver(([e]) => { enMenu = !!e && (e.isIntersecting || e.boundingClientRect.top < 0); visibilidad(); }, { rootMargin: '0px 0px -55% 0px' }).observe($('#menu')!);

/** Bolsa a la que vuela lo agregado: la de la isla si está (o va a estar) a la vista; si no
 *  (isla abierta en su panel), la de la barra superior. Nunca un lugar donde no hay bolsa. */
function destinoBolsa(): Destino | null {
  const c = isla.destinoBolsa();
  if (c) return { caja: c, el: isla.bolsaEl(), listaEn: isla.bolsaListaEn() };
  const b = $('#nav [data-abrir-lista]');
  const ico = b?.querySelector('.bolsa-ico')?.getBoundingClientRect();
  if (!b || !ico || ico.width === 0 || ico.bottom < 0 || ico.top > innerHeight) return null;
  return { caja: { x: ico.left - 8, y: ico.top - 8, w: ico.width + 16, h: ico.height + 16 }, el: b };
}
/** Foto pequeña para el aviso «Agregado». */
function miniatura(id: string) {
  const p = datos.platillos.find((x) => x.id === id);
  if (!p) return undefined;
  return p.foto ? miniRecorte(p.foto) : datos.reales[p.id]?.src ?? datos.iconos[p.catId];
}
/** La bolsa recibió el platillo (el contador ya rodó): rebota el líquido de la isla y aparece el aviso. */
function llego(id: string, n: number, destino: Destino | null) {
  visibilidad();
  isla.rebotar(destino?.el === isla.bolsaEl());
  const p = datos.platillos.find((x) => x.id === id);
  if (p) avisarAgregado({ id, nombre: p.nombre, foto: miniatura(id), n, bolsa: destino?.el, abrirPedido: () => { isla.cerrar(false); lista.abrir(); } });
}
prepararAviso();

/* ── Detalle del platillo ──────────────────────────────────────────── */
const hoja = crearHoja({
  agregar: (item) => lista.agregar(item),
  agregado: (item, destino) => llego(item.id, item.n, destino),
  isla,
  bolsa: destinoBolsa,
});

/* ── Clics: agregar directo, abrir el pedido, índice lateral, tarjeta ── */
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const rapido = t.closest<HTMLButtonElement>('[data-agregar]');
  if (rapido) {
    ev.stopPropagation();
    const id = rapido.dataset.agregar!;
    // Lo visible del contador espera a que la bebida llegue a la bolsa.
    const reserva = reservar();
    if (lista.agregar({ id, n: 1 })) { reserva.cancelar(); return; }
    const n = reserva.confirmar();
    navigator.vibrate?.(10);
    // 1 · El «+» se vuelve palomita sobre oro y regresa solo.
    rapido.classList.remove('hecho'); void rapido.offsetWidth; rapido.classList.add('hecho');
    clearTimeout(Number(rapido.dataset.t));
    rapido.dataset.t = String(window.setTimeout(() => rapido.classList.remove('hecho'), 1200));
    visibilidad();
    // 2 · La miniatura de la bebida viaja a la bolsa con su estela; 3 · la bolsa la recibe.
    const img = rapido.closest('article')?.querySelector<HTMLImageElement>('img[data-foto]');
    const destino = destinoBolsa();
    let origen = null;
    if (img) {
      const cubre = img.classList.contains('object-cover');
      const a = proporcion(img);
      const caja = cubre ? cajaDe(img) : rectImagen(cajaDe(img), a, 'contain');
      if (caja.w > 4 && caja.h > 4) origen = { src: img.currentSrc || img.src, a, caja, forma: cubre ? 'moneda' as const : 'recorte' as const };
    }
    void llevarALaBolsa({ reserva, destino, origen, seguir: destinoBolsa, alLlegar: () => llego(id, n, destino) });
    return;
  }
  if (t.closest('[data-abrir-lista]')) { ocultarAviso(true); lista.abrir(); return; }
  const comoPido = t.closest<HTMLElement>('[data-como-pido]');
  if (comoPido) { isla.cerrar(false); void import('./guia').then((m) => m.abrirComoPido(comoPido)).catch(() => { /* sin red: el enlace no hace nada */ }); return; }
  const riel = t.closest<HTMLElement>('.riel [data-ir]');
  if (riel) { ir(riel.dataset.ir!); return; }
  if (t.closest('a[href]')) return;
  const art = t.closest<HTMLElement>('article.producto');
  const b = art?.querySelector<HTMLElement>('[data-abrir]') ?? t.closest<HTMLElement>('[data-abrir]');
  if (b) hoja.abrir(b.dataset.abrir!, b);
});

/* ── Tras un despliegue nuevo, un archivo viejo puede ya no existir: recargar una vez ── */
addEventListener('vite:preloadError', (ev) => {
  try {
    if (sessionStorage.getItem('makizen-recargado')) return;
    sessionStorage.setItem('makizen-recargado', '1');
  } catch { return; }
  ev.preventDefault();
  location.reload();
});

/* ── Guía del comensal (pistas en el momento): se carga aparte, cuando termina la intro y el
      navegador está libre, para no tocar la carga inicial. Lógica en src/lib/guia.ts. ── */
function cargarGuia() {
  const ir = () => { void import('./guia').then((m) => m.iniciarGuia()).catch(() => { /* sin guía: el menú sigue igual */ }); };
  const libre = () => ('requestIdleCallback' in window ? requestIdleCallback(ir, { timeout: 1500 }) : setTimeout(ir, 300));
  if (!html.classList.contains('intro')) { libre(); return; }
  const mo = new MutationObserver(() => { if (!html.classList.contains('intro')) { mo.disconnect(); libre(); } });
  mo.observe(html, { attributes: true, attributeFilter: ['class'] });
}

/* ── Inicio ─────────────────────────────────────────────────────────── */
aplicarIdioma();
setInterval(pintarEstado, 60_000);
if (document.readyState === 'complete') cargarGuia(); else addEventListener('load', cargarGuia, { once: true });
