// Interacción del menú. Sin librerías: View Transitions API, IntersectionObserver,
// Web Animations API, CSS scroll-driven y un filtro SVG para la isla líquida.
import type { Platillo } from '../data/schema';
import { etiquetasHTML, precio, usd } from '../lib/etiquetas';
import { crearIsla } from './isla';

type Txt = { es: string; en: string };
type Real = { src: string; w: number; h: number };
type Datos = {
  tc: number;
  horario: { dia: number; abre: string; cierra: string }[];
  fotos: Record<string, [number, number]>;
  reales: Record<string, Real>;
  cats: { id: string; nombre: Txt }[];
  platillos: (Platillo & { cat: Txt })[];
};

const datos: Datos = JSON.parse(document.getElementById('datos-menu')!.textContent!);
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const busqueda = datos.platillos.map((p) => ({
  id: p.id, nombre: p.nombre, cat: p.cat, precio: precio(p.precio), foto: p.foto,
  texto: normalizar([p.nombre.es, p.nombre.en, p.descripcion?.es ?? '', p.descripcion?.en ?? '', p.cat.es, p.cat.en].join(' ')),
}));
const html = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esIngles = () => html.lang === 'en';
const vt = (fn: () => void) => {
  if (!document.startViewTransition || reducir()) { fn(); return null; }
  return document.startViewTransition(fn);
};
const enPantalla = (el: Element | null) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };

/* ── Telón de entrada ─────────────────────────────────────────────── */
const telon = $('#telon');
if (telon && html.classList.contains('con-telon')) {
  const levantar = () => {
    if (telon.classList.contains('fuera')) return;
    telon.classList.add('fuera');
    try { sessionStorage.setItem('makizen-telon', '1'); } catch {}
    setTimeout(() => telon.remove(), 1100);
  };
  telon.addEventListener('click', levantar);
  setTimeout(levantar, 1250);
}

/* ── Idioma ───────────────────────────────────────────────────────── */
let objetivo = html.lang;
function aplicarIdioma() {
  const en = esIngles();
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lang === 'en') === en)));
  const input = $<HTMLInputElement>('#buscar');
  if (input) { input.placeholder = en ? 'Search…' : 'Buscar…'; input.setAttribute('aria-label', en ? 'Search the menu' : 'Buscar en el menú'); }
  estado();
  requestAnimationFrame(() => { isla.pintar(); espiar(); });
}
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]');
  if (!b) return;
  const nuevo = b.dataset.lang === 'en' ? 'en' : 'es-MX';
  if (objetivo === nuevo) return;
  objetivo = nuevo;
  try { localStorage.setItem('makizen-idioma', nuevo === 'en' ? 'en' : 'es'); } catch {}
  html.classList.add('cambia-idioma');
  const t = vt(() => { html.lang = objetivo; aplicarIdioma(); });
  const fin = () => html.classList.remove('cambia-idioma');
  t ? t.finished.finally(fin) : fin();
});

/* ── Abierto / cerrado (hora de Sonora, sin horario de verano) ──────── */
const DIAS = [
  { es: 'el domingo', en: 'Sunday' }, { es: 'el lunes', en: 'Monday' }, { es: 'el martes', en: 'Tuesday' },
  { es: 'el miércoles', en: 'Wednesday' }, { es: 'el jueves', en: 'Thursday' }, { es: 'el viernes', en: 'Friday' }, { es: 'el sábado', en: 'Saturday' },
];
const min = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return h * 60 + m; };
const h12 = (t: string) => { const [h = 0, m = 0] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}${m ? ':' + String(m).padStart(2, '0') : ''} ${h < 12 ? 'am' : 'pm'}`; };
function ahoraSonora() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Hermosillo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
  const v = (k: string) => p.find((x) => x.type === k)?.value ?? '';
  return { dia: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(v('weekday')), min: Number(v('hour')) * 60 + Number(v('minute')) };
}
function estado() {
  const { dia, min: ahora } = ahoraSonora();
  const hoy = datos.horario.find((h) => h.dia === dia);
  let abierto = false; let es = ''; let en = '';
  if (hoy && ahora >= min(hoy.abre) && ahora < min(hoy.cierra)) {
    abierto = true; es = `Abierto ahora · cierra ${h12(hoy.cierra)}`; en = `Open now · closes ${h12(hoy.cierra)}`;
  } else if (hoy && ahora < min(hoy.abre)) {
    es = `Cerrado · abre hoy ${h12(hoy.abre)}`; en = `Closed · opens today ${h12(hoy.abre)}`;
  } else {
    for (let i = 1; i <= 7; i++) {
      const d = (dia + i) % 7; const h = datos.horario.find((x) => x.dia === d);
      if (!h) continue;
      const cuando = i === 1 ? { es: 'mañana', en: 'tomorrow' } : DIAS[d]!;
      es = `Cerrado · abre ${cuando.es} ${h12(h.abre)}`; en = `Closed · opens ${cuando.en} ${h12(h.abre)}`;
      break;
    }
  }
  $$('[data-estado-local]').forEach((el) => {
    $('.punto', el)!.className = `punto relative size-2.5 rounded-full ${abierto ? 'pulso text-abierto' : 'text-cerrado'}`;
    $('.texto', el)!.innerHTML = `<span lang="es">${es}</span><span lang="en">${en}</span>`;
  });
  $$('#horario [data-dia]').forEach((li) => li.classList.toggle('hoy', Number(li.dataset.dia) === dia));
}

/* ── Portada en formato historias ──────────────────────────────────── */
const hero = $('.hero')!;
const historias = $$<HTMLImageElement>('.historia', hero);
const barras = $$('.barra-h', hero);
let actual = 0; let reloj = 0;
const DUR = 6000;
function verHistoria(n: number) {
  actual = (n + historias.length) % historias.length;
  historias.forEach((h, i) => {
    h.classList.toggle('activa', i === actual);
    if (i === actual) { h.loading = 'eager'; h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; }
  });
  barras.forEach((b, i) => {
    b.classList.toggle('vista', i < actual);
    b.classList.remove('activa');
    if (i === actual) { void b.offsetWidth; b.classList.add('activa'); }
  });
  clearTimeout(reloj);
  if (!reducir()) reloj = window.setTimeout(() => verHistoria(actual + 1), DUR);
}
hero.style.setProperty('--dur', `${DUR}ms`);
$$('[data-historia]').forEach((b) => b.addEventListener('click', () => verHistoria(actual + Number(b.dataset.historia))));
new IntersectionObserver(([e]) => {
  const fuera = !e?.isIntersecting;
  hero.classList.toggle('pausada', fuera);
  if (fuera) clearTimeout(reloj); else verHistoria(actual);
}).observe(hero);
// Precarga las demás fotos cuando el navegador esté libre.
(window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1500)))(() => historias.forEach((h) => (h.loading = 'eager')));

/* ── Aparición al hacer scroll ─────────────────────────────────────── */
const revela = new IntersectionObserver(
  (entradas) => entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); revela.unobserve(e.target); } }),
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);
$$('.revela').forEach((el) => revela.observe(el));

/* ── Tarjetas con inclinación 3D (solo con cursor) ─────────────────── */
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reducir()) {
  $$('.inclinable').forEach((card) => {
    let raf = 0;
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${(x - 0.5) * 10}deg`);
        card.style.setProperty('--rx', `${(0.5 - y) * 8}deg`);
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.setProperty('--brillo', '1');
      });
    });
    card.addEventListener('pointerleave', () => { ['--rx', '--ry'].forEach((p) => card.style.setProperty(p, '0deg')); card.style.setProperty('--brillo', '0'); });
  });
}

/* ── Isla dinámica + categoría activa ──────────────────────────────── */
const secciones = $$('[data-seccion]');
function ir(id: string) {
  const sec = document.getElementById(id);
  if (!sec) return;
  const i = datos.cats.findIndex((c) => c.id === id);
  isla.actualizar(i, i >= isla.indice ? 1 : -1);
  bloqueo = Date.now() + 1000;
  setTimeout(espiar, 1050);
  $$('.revela', sec).forEach((el) => el.classList.add('visto'));
  sec.scrollIntoView({ behavior: reducir() ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', `#${id}`);
  sec.classList.remove('llega'); void sec.offsetWidth; sec.classList.add('llega');
  setTimeout(() => sec.classList.remove('llega'), 1300);
}
const isla = crearIsla({
  cats: datos.cats,
  platillos: busqueda,
  ir,
  abrir: (id) => abrir(id, null),
  reducir,
});

let bloqueo = 0; let pendiente = false;
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
// La isla aparece cuando la portada sale de la pantalla.
new IntersectionObserver(([e]) => isla.mostrar(!!e && !e.isIntersecting && e.boundingClientRect.top < 0)).observe($('#centinela')!);

/* ── Hoja de detalle ────────────────────────────────────────────────── */
const hoja = $<HTMLDialogElement>('#hoja')!;
const panel = $('.hoja-panel', hoja)!;
const hojaImg = $<HTMLImageElement>('#hoja-img')!;
const cuerpo = $('#hoja-cuerpo')!;
let origen: HTMLImageElement | null = null;
let disparador: HTMLElement | null = null;

function llenar(p: Datos['platillos'][number]) {
  const t = p.foto ? datos.fotos[p.foto] : undefined;
  const real = datos.reales[p.id];
  if (p.foto && t) {
    hojaImg.src = `/menu/${p.foto}.webp`; hojaImg.width = t[0]; hojaImg.height = t[1];
    hojaImg.classList.remove('opacity-40', 'max-h-[120px]');
  } else {
    hojaImg.src = '/brand/logo-isotipo.png'; hojaImg.width = 286; hojaImg.height = 286;
    hojaImg.classList.add('opacity-40', 'max-h-[120px]');
  }
  const d = (n: number) => `style="--d:${n}"`;
  cuerpo.innerHTML = `
    <p ${d(0)} class="font-alt text-[12px] uppercase tracking-[0.28em] text-oro"><span lang="es">${p.cat.es}</span><span lang="en">${p.cat.en}</span></p>
    <h2 ${d(1)} id="hoja-titulo" class="mt-1 text-[28px] font-bold leading-tight"><span lang="es">${p.nombre.es}</span><span lang="en">${p.nombre.en}</span></h2>
    <p ${d(1)} class="mt-1 text-[14px] text-humo"><span lang="en">${p.nombre.es}</span><span lang="es">${p.nombre.en}</span></p>
    <div ${d(2)} class="mt-4 flex items-end justify-between gap-4 border-y border-oro/30 py-3">
      <p class="text-[30px] font-bold tabular-nums ${p.agotado ? 'line-through decoration-2' : ''}">${precio(p.precio)} <span class="text-[14px] font-normal text-niebla">MXN</span></p>
      <p class="text-right text-[14px] text-humo">${usd(p.precio, datos.tc)}<br><span lang="es">referencia</span><span lang="en">reference only</span></p>
    </div>
    ${p.agotado ? `<p ${d(3)} class="mt-4 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-[15px]"><span lang="es">Hoy está agotado. Pregunta por una alternativa.</span><span lang="en">Sold out today. Ask us for an alternative.</span></p>` : ''}
    ${p.descripcion ? `<p ${d(3)} class="mt-4 text-[17px] leading-relaxed text-niebla"><span lang="es">${p.descripcion.es}</span><span lang="en">${p.descripcion.en}</span></p>` : ''}
    ${p.gramos ? `<p ${d(4)} class="mt-2 text-[15px] text-humo"><span lang="es">Porción</span><span lang="en">Portion</span>: ${p.gramos} g</p>` : ''}
    ${p.incluye ? `<ul ${d(4)} class="mt-4 grid gap-2">${p.incluye.map((x) => `<li class="flex items-center gap-3 text-[16px]"><span class="size-1.5 rounded-full bg-oro"></span>${x}</li>`).join('')}</ul>` : ''}
    <ul ${d(5)} class="visto mt-5 flex flex-wrap gap-2">${etiquetasHTML(p)}</ul>
    ${real ? `<figure ${d(6)} class="mt-6 overflow-hidden rounded-3xl border border-oro/30">
      <img src="${real.src}" width="${real.w}" height="${real.h}" alt="" class="block max-h-[420px] w-full object-cover" loading="lazy">
      <figcaption class="flex items-center gap-2 bg-pizarra px-4 py-3 text-[13px] text-niebla"><span class="size-1.5 rounded-full bg-oro"></span><span lang="es">Así llega a tu mesa · foto de @makizen.puertopenasco</span><span lang="en">How it's served · photo by @makizen.puertopenasco</span></figcaption>
    </figure>` : ''}
    <a ${d(7)} href="tel:+526383882836" class="presionable tap mt-6 flex items-center justify-center gap-2 rounded-full bg-oro px-5 py-3 text-[16px] font-semibold text-noche hover:bg-oro-claro">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>
      <span lang="es">Llamar para pedir</span><span lang="en">Call to order</span>
    </a>`;
  cuerpo.classList.remove('hoja-escalonada'); void cuerpo.offsetWidth; cuerpo.classList.add('hoja-escalonada');
}

function abrir(id: string, boton: HTMLElement | null) {
  const p = datos.platillos.find((x) => x.id === id);
  if (!p) return;
  disparador = boton ?? $('.isla-pildora');
  origen = boton?.closest('article')?.querySelector<HTMLImageElement>('img[data-foto]') ?? null;
  if (!enPantalla(origen)) origen = null;
  const mostrar = () => { llenar(p); hoja.showModal(); panel.scrollTop = 0; html.style.overflow = 'hidden'; };
  if (origen && document.startViewTransition && !reducir()) {
    // La foto viaja de la tarjeta a la hoja; el panel sube por debajo.
    hoja.classList.add('vt');
    origen.style.viewTransitionName = 'foto-platillo';
    const t = document.startViewTransition(() => {
      origen!.style.viewTransitionName = '';
      mostrar();
      hojaImg.style.viewTransitionName = 'foto-platillo';
    });
    t.finished.finally(() => { hojaImg.style.viewTransitionName = ''; hoja.classList.remove('vt'); });
  } else {
    mostrar();
  }
}

let cerrandoYa = false;
function cerrar(inmediato = false) {
  if (!hoja.open || cerrandoYa) return;
  cerrandoYa = true;
  const fin = () => {
    hoja.close(); hoja.classList.remove('cerrando'); panel.style.transform = '';
    html.style.overflow = ''; cerrandoYa = false; disparador?.focus({ preventScroll: true });
  };
  if (inmediato) fin();
  else if (origen && enPantalla(origen) && document.startViewTransition && !reducir()) {
    hoja.classList.add('vt');
    hojaImg.style.viewTransitionName = 'foto-platillo';
    const t = document.startViewTransition(() => { hojaImg.style.viewTransitionName = ''; origen!.style.viewTransitionName = 'foto-platillo'; fin(); });
    t.finished.finally(() => { if (origen) origen.style.viewTransitionName = ''; hoja.classList.remove('vt'); });
  } else if (reducir()) fin();
  else {
    hoja.classList.add('cerrando');
    const anim = panel.getAnimations()[0];
    anim ? anim.finished.then(fin, fin) : setTimeout(fin, 280);
  }
}

document.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-abrir]');
  if (b) abrir(b.dataset.abrir!, b);
});
$('[data-cerrar]', hoja)!.addEventListener('click', () => cerrar());
hoja.addEventListener('cancel', (ev) => { ev.preventDefault(); cerrar(); });
hoja.addEventListener('click', (ev) => { if (ev.target === hoja) cerrar(); });

// Deslizar hacia abajo para cerrar (desde el asa o con el panel arriba del todo).
let y0 = 0; let dy = 0; let arrastrando = false;
panel.addEventListener('pointerdown', (ev) => {
  const enAsa = !!(ev.target as HTMLElement).closest('.asa');
  if (ev.pointerType === 'mouse' && !enAsa) return;
  if (panel.scrollTop > 0 && !enAsa) return;
  y0 = ev.clientY; dy = 0; arrastrando = true;
});
addEventListener('pointermove', (ev) => {
  if (!arrastrando) return;
  dy = Math.max(0, ev.clientY - y0);
  if (dy > 4) { panel.style.transition = 'none'; panel.style.transform = `translateY(${dy}px)`; }
});
addEventListener('pointerup', () => {
  if (!arrastrando) return;
  arrastrando = false;
  if (dy > 110) {
    const a = panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(105%)' }], { duration: reducir() ? 1 : 220, easing: 'ease-in' });
    a.finished.then(() => { panel.style.transition = ''; panel.style.transform = 'translateY(105%)'; cerrar(true); });
  } else {
    panel.style.transition = 'transform 300ms cubic-bezier(0.34, 1.4, 0.64, 1)';
    panel.style.transform = '';
    setTimeout(() => (panel.style.transition = ''), 320);
  }
});

/* ── Inicio ─────────────────────────────────────────────────────────── */
verHistoria(0);
aplicarIdioma();
setInterval(estado, 60_000);
