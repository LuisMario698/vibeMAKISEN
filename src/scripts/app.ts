// Interacción del menú. Sin librerías: View Transitions API, IntersectionObserver,
// Web Animations API y CSS. Todo degrada bien si el navegador no lo soporta.
import type { Platillo } from '../data/schema';
import { etiquetasHTML, precio, usd } from '../lib/etiquetas';

type Txt = { es: string; en: string };
type Datos = {
  tc: number;
  horario: { dia: number; abre: string; cierra: string }[];
  fotos: Record<string, [number, number]>;
  platillos: (Platillo & { cat: Txt })[];
};

const datos: Datos = JSON.parse(document.getElementById('datos-menu')!.textContent!);
const html = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esIngles = () => html.lang === 'en';
const vt = (fn: () => void) => {
  if (!document.startViewTransition || reducir()) { fn(); return null; }
  return document.startViewTransition(fn);
};

/* ── Idioma ──────────────────────────────────────────────────────────── */
const TEXTOS = {
  buscar: { es: 'Buscar…', en: 'Search…' },
};
function aplicarIdioma() {
  const en = esIngles();
  $$('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.lang === 'en') === en)));
  const input = $<HTMLInputElement>('#buscar');
  if (input) { input.placeholder = TEXTOS.buscar[en ? 'en' : 'es']; input.setAttribute('aria-label', en ? 'Search the menu' : 'Buscar en el menú'); }
  estado();
  requestAnimationFrame(() => { espiar(); moverIndicador(false); });
}
let objetivo = html.lang;
$$('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    const nuevo = b.dataset.lang === 'en' ? 'en' : 'es-MX';
    if (objetivo === nuevo) return;
    objetivo = nuevo;
    try { localStorage.setItem('makizen-idioma', nuevo === 'en' ? 'en' : 'es'); } catch {}
    html.classList.add('cambia-idioma');
    const t = vt(() => { html.lang = objetivo; aplicarIdioma(); });
    const fin = () => html.classList.remove('cambia-idioma');
    t ? t.finished.finally(fin) : fin();
  }),
);

/* ── Abierto / cerrado (hora de Sonora, sin horario de verano) ──────────── */
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
  const el = $('#estado');
  if (!el) return;
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
  $('.punto', el)!.className = `punto relative size-2.5 rounded-full ${abierto ? 'pulso text-abierto' : 'text-cerrado'}`;
  $('.texto', el)!.innerHTML = `<span lang="es">${es}</span><span lang="en">${en}</span>`;
  $$('#horario [data-dia]').forEach((li) => li.classList.toggle('hoy', Number(li.dataset.dia) === dia));
}

/* ── Aparición al hacer scroll ─────────────────────────────────────── */
const revela = new IntersectionObserver(
  (entradas) => entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); revela.unobserve(e.target); } }),
  { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
);
$$('.revela').forEach((el) => revela.observe(el));

/* ── Barra fija + categoría activa + indicador deslizante ──────────────── */
const barra = $('.barra')!;
const caja = $('.chips')!;
const indicador = $('.indicador')!;
let activa = '';
new IntersectionObserver(([e]) => barra.classList.toggle('fija', !!e && !e.isIntersecting && e.boundingClientRect.top < 0)).observe($('#centinela')!);

function moverIndicador(suave = true) {
  const chip = $<HTMLAnchorElement>(`[data-chip="${activa}"]`);
  if (!chip) { indicador.style.width = '0px'; return; }
  if (!suave) indicador.style.transition = 'none';
  indicador.style.width = `${chip.offsetWidth}px`;
  indicador.style.transform = `translateX(${chip.offsetLeft}px)`;
  if (!suave) requestAnimationFrame(() => (indicador.style.transition = ''));
  const x = chip.offsetLeft - caja.clientWidth / 2 + chip.offsetWidth / 2;
  caja.scrollTo({ left: x, behavior: suave && !reducir() ? 'smooth' : 'auto' });
}
function activar(id: string) {
  if (id === activa) return;
  activa = id;
  $$('[data-chip]').forEach((c) => c.setAttribute('aria-current', String(c.dataset.chip === id)));
  moverIndicador();
}
// Categoría activa: la última sección cuyo inicio ya pasó el 38 % de la pantalla.
const secciones = $$('[data-seccion]');
let bloqueo = 0;
let pendiente = false;
function espiar() {
  pendiente = false;
  if (Date.now() < bloqueo) return;
  const linea = innerHeight * 0.38;
  let id = '';
  for (const s of secciones) {
    if (s.classList.contains('oculto-busqueda')) continue;
    if (s.getBoundingClientRect().top <= linea) id = s.dataset.seccion!;
    else break;
  }
  if (id) activar(id);
}
addEventListener('scroll', () => { if (!pendiente) { pendiente = true; requestAnimationFrame(espiar); } }, { passive: true });

// Al tocar una categoría: desplazamiento suave y destello dorado en su título.
$$<HTMLAnchorElement>('[data-chip]').forEach((a) =>
  a.addEventListener('click', (ev) => {
    ev.preventDefault();
    const sec = document.getElementById(a.dataset.chip!);
    if (!sec) return;
    activar(sec.id);
    bloqueo = Date.now() + 900;
    setTimeout(espiar, 950);
    sec.scrollIntoView({ behavior: reducir() ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', `#${sec.id}`);
    sec.classList.remove('llega'); void sec.offsetWidth; sec.classList.add('llega');
    $$('.revela', sec).forEach((el) => el.classList.add('visto'));
    setTimeout(() => sec.classList.remove('llega'), 1300);
  }),
);

/* ── Búsqueda ───────────────────────────────────────────────────────── */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const buscar = $<HTMLInputElement>('#buscar')!;
buscar.addEventListener('input', () => {
  const q = norm(buscar.value);
  let hay = 0;
  $$('[data-seccion]').forEach((sec) => {
    let n = 0;
    $$('[data-buscar]', sec).forEach((li) => {
      const ok = !q || q.split(/\s+/).every((w) => li.dataset.buscar!.includes(w));
      li.classList.toggle('oculto-busqueda', !ok);
      if (ok) { n++; li.classList.add('visto'); }
    });
    sec.classList.toggle('oculto-busqueda', n === 0);
    $$('.revela', sec).forEach((el) => el.classList.add('visto'));
    hay += n;
  });
  $('#sin-resultados')!.hidden = hay > 0;
  const menu = $('#menu')!;
  if (q && menu.getBoundingClientRect().top > 140) menu.scrollIntoView({ behavior: reducir() ? 'auto' : 'smooth' });
});

/* ── Hoja de detalle ────────────────────────────────────────────────── */
const hoja = $<HTMLDialogElement>('#hoja')!;
const panel = $('.hoja-panel', hoja)!;
const hojaImg = $<HTMLImageElement>('#hoja-img')!;
const cuerpo = $('#hoja-cuerpo')!;
let origen: HTMLImageElement | null = null;
let disparador: HTMLElement | null = null;

function llenar(p: Datos['platillos'][number]) {
  const t = p.foto ? datos.fotos[p.foto] : undefined;
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
    <h2 ${d(1)} id="hoja-titulo" class="mt-1 text-[26px] font-bold leading-tight"><span lang="es">${p.nombre.es}</span><span lang="en">${p.nombre.en}</span></h2>
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
    <a ${d(6)} href="tel:+526383882836" class="presionable tap mt-6 flex items-center justify-center gap-2 rounded-full bg-oro px-5 py-3 text-[16px] font-semibold text-noche hover:bg-oro-claro">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>
      <span lang="es">Llamar para pedir</span><span lang="en">Call to order</span>
    </a>`;
  // Reinicia la entrada escalonada.
  cuerpo.classList.remove('hoja-escalonada'); void cuerpo.offsetWidth; cuerpo.classList.add('hoja-escalonada');
}

function abrir(id: string, boton: HTMLElement) {
  const p = datos.platillos.find((x) => x.id === id);
  if (!p) return;
  disparador = boton;
  origen = boton.closest('article')?.querySelector<HTMLImageElement>('img[data-foto]') ?? null;
  const mostrar = () => { llenar(p); hoja.showModal(); panel.scrollTop = 0; document.body.style.overflow = 'hidden'; };
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
    document.body.style.overflow = ''; cerrandoYa = false; disparador?.focus({ preventScroll: true });
  };
  const visibleOrigen = origen && origen.getBoundingClientRect().bottom > 0 && origen.getBoundingClientRect().top < innerHeight;
  if (inmediato) {
    fin();
  } else if (origen && visibleOrigen && document.startViewTransition && !reducir()) {
    hoja.classList.add('vt');
    hojaImg.style.viewTransitionName = 'foto-platillo';
    const t = document.startViewTransition(() => { hojaImg.style.viewTransitionName = ''; origen!.style.viewTransitionName = 'foto-platillo'; fin(); });
    t.finished.finally(() => { if (origen) origen.style.viewTransitionName = ''; hoja.classList.remove('vt'); });
  } else if (reducir()) {
    fin();
  } else {
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
  if (ev.pointerType === 'mouse' && !(ev.target as HTMLElement).closest('.asa')) return;
  if (panel.scrollTop > 0 && !(ev.target as HTMLElement).closest('.asa')) return;
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
aplicarIdioma();
setInterval(estado, 60_000);
addEventListener('resize', () => moverIndicador(false));
