// Interacción del menú. Sin librerías: Web Animations API, IntersectionObserver,
// CSS scroll-driven, filtro SVG "goo" para la isla y clip-path + FLIP para el detalle.
// Este archivo solo conecta los módulos: idioma, estado del local, isla, hoja y lista.
import { precio } from '../lib/precios';
import { normalizar } from '../lib/texto';
import { $, $$, datos, guardar, html, reducir } from './comun';
import { pintarEstado } from './estado';
import { crearHoja } from './hoja';
import { crearIsla } from './isla';
import { crearLista } from './lista';
import { aLaBolsa, cajaDe, proporcion, rectImagen } from './morfo';

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
  requestAnimationFrame(() => { isla.pintar(); espiar(); });
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
const nav = $('#nav')!;
addEventListener('scroll', () => nav.classList.toggle('solida', scrollY > 24), { passive: true });

/* ── Aparición al hacer scroll ─────────────────────────────────────── */
const revela = new IntersectionObserver(
  (entradas) => entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); revela.unobserve(e.target); } }),
  { rootMargin: '0px 0px -10% 0px', threshold: 0.06 },
);
$$('.revela, .cortina').forEach((el) => revela.observe(el));

/* ── Categorías: isla, índice lateral y categoría activa ───────────── */
const secciones = $$('[data-seccion]');
let bloqueo = 0; let pendiente = false;
function ir(id: string) {
  const sec = document.getElementById(id);
  if (!sec) return;
  const i = datos.cats.findIndex((c) => c.id === id);
  isla.actualizar(i, i >= isla.indice ? 1 : -1);
  bloqueo = Date.now() + 1000;
  setTimeout(espiar, 1050);
  $$('.revela, .cortina', sec).forEach((el) => el.classList.add('visto'));
  sec.scrollIntoView({ behavior: reducir() ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(history.state, '', `#${id}`);
  sec.classList.remove('llega'); void sec.offsetWidth; sec.classList.add('llega');
  setTimeout(() => sec.classList.remove('llega'), 1300);
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
  abrirLista: () => { isla.cerrar(false); lista.abrir(); },
  reducir,
});

function espiar() {
  pendiente = false;
  if (Date.now() < bloqueo) return;
  const linea = innerHeight * 0.4;
  let i = -1;
  secciones.forEach((s, k) => { if (s.getBoundingClientRect().top <= linea) i = k; });
  const nuevo = Math.max(0, i);
  if (nuevo !== isla.indice) isla.actualizar(nuevo, nuevo > isla.indice ? 1 : -1);
}
addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(espiar); } }, { passive: true });

/* ── Mi lista ──────────────────────────────────────────────────────── */
let enMenu = false;
let piezasLista = 0;
const visibilidad = () => isla.mostrar(enMenu || piezasLista > 0);
const lista = crearLista({
  alCambiar: (n, total) => {
    piezasLista = n;
    isla.contar(n, precio(total));
    $$('[data-contador-lista]').forEach((el) => { el.textContent = String(n); el.hidden = n === 0; });
    const en = html.lang === 'en';
    $$('#nav [data-abrir-lista]').forEach((b) => b.setAttribute('aria-label', en ? `My list: ${n} ${n === 1 ? 'item' : 'items'}, ${precio(total)}` : `Mi lista: ${n} ${n === 1 ? 'artículo' : 'artículos'}, ${precio(total)}`));
    visibilidad();
  },
});
// La isla aparece al llegar al menú, o siempre que la lista tenga algo.
new IntersectionObserver(([e]) => { enMenu = !!e && (e.isIntersecting || e.boundingClientRect.top < 0); visibilidad(); }, { rootMargin: '0px 0px -55% 0px' }).observe($('#menu')!);

/* ── Detalle del platillo ──────────────────────────────────────────── */
const hoja = crearHoja({
  agregar: (item) => lista.agregar(item),
  agregado: () => { visibilidad(); isla.rebotar(); },
  isla,
});

/* ── Clics: agregar directo, abrir la lista, índice lateral, tarjeta ── */
document.addEventListener('click', (ev) => {
  const t = ev.target as HTMLElement;
  const rapido = t.closest<HTMLButtonElement>('[data-agregar]');
  if (rapido) {
    ev.stopPropagation();
    if (lista.agregar({ id: rapido.dataset.agregar!, n: 1 })) return;
    rapido.classList.remove('ok'); void rapido.offsetWidth; rapido.classList.add('ok');
    visibilidad();
    // La miniatura de la bebida cae en la bolsa de Mi lista.
    const img = rapido.closest('article')?.querySelector<HTMLImageElement>('img[data-foto]');
    const destino = isla.destinoBolsa();
    if (img && destino && !reducir()) {
      const cubre = img.classList.contains('object-cover');
      const a = proporcion(img);
      const desde = cubre ? cajaDe(img) : rectImagen(cajaDe(img), a, 'contain');
      void aLaBolsa(img.currentSrc || img.src, a, desde, destino, cubre).then(() => isla.rebotar());
    } else requestAnimationFrame(() => isla.rebotar());
    return;
  }
  if (t.closest('[data-abrir-lista]')) { lista.abrir(); return; }
  const riel = t.closest<HTMLElement>('.riel [data-ir]');
  if (riel) { ir(riel.dataset.ir!); return; }
  if (t.closest('a[href]')) return;
  const art = t.closest<HTMLElement>('article.producto');
  const b = art?.querySelector<HTMLElement>('[data-abrir]') ?? t.closest<HTMLElement>('[data-abrir]');
  if (b) hoja.abrir(b.dataset.abrir!, b);
});

/* ── Inicio ─────────────────────────────────────────────────────────── */
aplicarIdioma();
setInterval(pintarEstado, 60_000);
