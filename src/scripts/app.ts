// Interacción del menú. Sin librerías: Web Animations API, IntersectionObserver,
// CSS scroll-driven y filtros SVG "goo" para la isla y el des-merge del detalle.
import type { Platillo } from '../data/schema';
import { etiquetasHTML, precio, usd } from '../lib/etiquetas';
import { crearIsla } from './isla';
import { cajaDe, contenido, crearLiquido, type Caja } from './liquido';

type Txt = { es: string; en: string };
type Foto = { src: string; srcset: string; w: number; h: number };
type Modo = 'recorte' | 'foto' | 'fila';
type Datos = {
  tc: number;
  horario: { dia: number; abre: string; cierra: string }[];
  fotos: Record<string, [number, number]>;
  reales: Record<string, Foto>;
  cats: { id: string; nombre: Txt }[];
  platillos: (Platillo & { cat: Txt })[];
};

const datos: Datos = JSON.parse(document.getElementById('datos-menu')!.textContent!);
const html = document.documentElement;
const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esIngles = () => html.lang === 'en';
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const enPantalla = (el: Element | null | undefined) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.bottom > 40 && r.top < innerHeight - 40; };
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

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
  const cambiar = () => { html.lang = objetivo; aplicarIdioma(); };
  if (!document.startViewTransition || reducir()) { cambiar(); return; }
  html.classList.add('cambia-idioma');
  document.startViewTransition(cambiar).finished.finally(() => html.classList.remove('cambia-idioma'));
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
    $('.punto', el)!.className = `punto relative size-2 rounded-full ${abierto ? 'punto-vivo text-abierto' : 'text-cerrado'}`;
    $('.texto', el)!.innerHTML = `<span lang="es">${es}</span><span lang="en">${en}</span>`;
  });
  const hoyEl = $('[data-hoy]');
  if (hoyEl) hoyEl.innerHTML = hoy ? `${h12(hoy.abre).replace(' pm', '')}–${h12(hoy.cierra)}` : '<span lang="es">Cerrado</span><span lang="en">Closed</span>';
  $$('#horario [data-dia]').forEach((li) => li.classList.toggle('hoy', Number(li.dataset.dia) === dia));
}

/* ── Barra superior: sólida al salir de la portada ─────────────────── */
const nav = $('#nav')!;
addEventListener('scroll', () => nav.classList.toggle('solida', scrollY > 24), { passive: true });

/* ── Aparición al hacer scroll ─────────────────────────────────────── */
const revela = new IntersectionObserver(
  (entradas) => entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visto'); revela.unobserve(e.target); } }),
  { rootMargin: '0px 0px -10% 0px', threshold: 0.06 },
);
$$('.revela, .cortina').forEach((el) => revela.observe(el));

/* ── Isla dinámica + categoría activa ──────────────────────────────── */
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
  history.replaceState(null, '', `#${id}`);
  sec.classList.remove('llega'); void sec.offsetWidth; sec.classList.add('llega');
  setTimeout(() => sec.classList.remove('llega'), 1300);
}
const isla = crearIsla({
  cats: datos.cats,
  platillos: datos.platillos.map((p) => ({
    id: p.id, nombre: p.nombre, cat: p.cat, precio: precio(p.precio), foto: p.foto,
    texto: normalizar([p.nombre.es, p.nombre.en, p.descripcion?.es ?? '', p.descripcion?.en ?? '', p.cat.es, p.cat.en].join(' ')),
  })),
  ir,
  abrir: (id) => abrir(id, null),
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
// La isla aparece al llegar al menú.
const inicioMenu = $('#menu')!;
new IntersectionObserver(([e]) => isla.mostrar(!!e && (e.isIntersecting || e.boundingClientRect.top < 0)), { rootMargin: '0px 0px -55% 0px' }).observe(inicioMenu);

/* ── Hoja de detalle con des-merge líquido ─────────────────────────── */
const hoja = $<HTMLDialogElement>('#hoja')!;
const panel = $('.hoja-panel', hoja)!;
const scroller = $('.hoja-scroll', hoja)!;
const hojaImg = $<HTMLImageElement>('#hoja-img')!;
const cuerpo = $('#hoja-cuerpo')!;
const liquido = crearLiquido();
let origen: HTMLElement | null = null;
let modoActual: Modo = 'fila';
let disparador: HTMLElement | null = null;
let ocupado = false;

const RADIO: Record<Modo, number> = { recorte: 22, foto: 24, fila: 14 };
const ALTO_FOTO = 300;

function cajaHoja(): Caja {
  const w = Math.min(innerWidth, 576);
  const h = Math.round(Math.min(innerHeight * 0.88, 780));
  hoja.style.setProperty('--alto-hoja', `${h}px`);
  return { x: (innerWidth - w) / 2, y: innerHeight - h, w, h };
}
/** Dónde queda la imagen principal dentro de la hoja. */
function cajaImagenHoja(S: Caja, modo: Modo, img?: HTMLImageElement | null): Caja {
  const marco: Caja = { x: S.x, y: S.y, w: S.w, h: ALTO_FOTO };
  if (modo === 'foto' || !img) return marco;
  return contenido(img, { x: S.x + S.w * 0.1, y: S.y + 30, w: S.w * 0.8, h: 240 });
}

function llenar(p: Datos['platillos'][number], modo: Modo, fotoReal?: string) {
  const t = p.foto ? datos.fotos[p.foto] : undefined;
  const real = datos.reales[p.id];
  const caja = $('.hoja-foto', hoja)!;
  hojaImg.removeAttribute('srcset');
  if (modo === 'foto' && fotoReal) {
    hojaImg.src = fotoReal; hojaImg.className = 'hoja-foto-img absolute inset-0 h-full w-full object-cover';
    caja.classList.add('con-foto');
  } else if (p.foto && t) {
    hojaImg.src = `/menu/${p.foto}.webp`; hojaImg.width = t[0]; hojaImg.height = t[1];
    hojaImg.className = 'hoja-foto-img relative max-h-[240px] w-auto max-w-[80%] object-contain drop-shadow-[0_26px_24px_rgb(0_0_0/0.85)]';
    caja.classList.remove('con-foto');
  } else {
    hojaImg.src = '/brand/isotipo.svg'; hojaImg.width = 579; hojaImg.height = 599;
    hojaImg.className = 'hoja-foto-img relative h-28 w-auto opacity-30';
    caja.classList.remove('con-foto');
  }
  const d = (n: number) => `style="--d:${n}"`;
  cuerpo.innerHTML = `
    <p ${d(0)} class="ceja mt-5"><span lang="es">${p.cat.es}</span><span lang="en">${p.cat.en}</span></p>
    <h2 ${d(1)} id="hoja-titulo" class="mt-2 text-[30px] font-semibold leading-[1.08] tracking-[-0.025em]"><span lang="es">${p.nombre.es}</span><span lang="en">${p.nombre.en}</span></h2>
    <p ${d(1)} class="mt-1 text-[14px] text-humo"><span lang="en">${p.nombre.es}</span><span lang="es">${p.nombre.en}</span></p>
    <div ${d(2)} class="mt-5 flex items-end justify-between gap-4 rounded-2xl bg-noche/40 px-4 py-3 ring-1 ring-white/[0.05]">
      <p class="text-[30px] font-semibold tabular-nums leading-none ${p.agotado ? 'line-through decoration-2' : ''}">${precio(p.precio)} <span class="text-[13px] font-normal text-niebla">MXN</span></p>
      <p class="text-right text-[13px] leading-tight text-humo">${usd(p.precio, datos.tc)}<br><span lang="es">referencia</span><span lang="en">reference only</span></p>
    </div>
    ${p.agotado ? `<p ${d(3)} class="mt-4 rounded-2xl bg-hueso/[0.06] px-4 py-3 text-[15px]"><span lang="es">Hoy está agotado. Pregunta por una alternativa.</span><span lang="en">Sold out today. Ask us for an alternative.</span></p>` : ''}
    ${p.descripcion ? `<p ${d(3)} class="mt-5 text-[17px] leading-relaxed text-hueso/85"><span lang="es">${p.descripcion.es}</span><span lang="en">${p.descripcion.en}</span></p>` : ''}
    ${p.gramos ? `<p ${d(4)} class="mt-2 text-[14px] text-humo"><span lang="es">Porción</span><span lang="en">Portion</span>: ${p.gramos} g</p>` : ''}
    ${p.incluye ? `<ul ${d(4)} class="mt-4 grid gap-2">${p.incluye.map((x) => `<li class="flex items-center gap-3 text-[16px]"><span class="size-1.5 rounded-full bg-oro"></span>${x}</li>`).join('')}</ul>` : ''}
    <ul ${d(5)} class="visto mt-5 flex flex-wrap gap-2 empty:hidden">${etiquetasHTML(p)}</ul>
    ${real && modo !== 'foto' ? `<figure ${d(6)} class="mt-6 overflow-hidden rounded-3xl ring-1 ring-white/[0.06]">
      <img src="${real.src}" srcset="${real.srcset}" sizes="(min-width: 576px) 536px, 92vw" width="${real.w}" height="${real.h}" alt="" class="block max-h-[440px] w-full object-cover" loading="lazy">
      <figcaption class="bg-noche/40 px-4 py-3 text-[13px] text-niebla"><span lang="es">Así llega a tu mesa · foto de @makizen.puertopenasco</span><span lang="en">How it's served · photo by @makizen.puertopenasco</span></figcaption>
    </figure>` : ''}
    <a ${d(7)} href="tel:+526383882836" class="boton-oro presionable mt-6 w-full text-[16px]">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>
      <span lang="es">Llamar para pedir</span><span lang="en">Call to order</span>
    </a>`;
  cuerpo.classList.remove('hoja-escalonada'); void cuerpo.offsetWidth; cuerpo.classList.add('hoja-escalonada');
}

function abrirDialogo() {
  hoja.showModal();
  scroller.scrollTop = 0;
  html.classList.add('bloqueo');
}

async function abrir(id: string, boton: HTMLElement | null) {
  const p = datos.platillos.find((x) => x.id === id);
  if (!p || ocupado) return;
  disparador = boton ?? $('.isla-pildora');
  origen = boton?.closest<HTMLElement>('article.producto') ?? null;
  modoActual = (origen?.dataset.modo as Modo) ?? 'fila';
  const imgOrigen = origen?.querySelector<HTMLImageElement>('img[data-foto]') ?? null;
  const fotoReal = modoActual === 'foto' && imgOrigen ? imgOrigen.currentSrc || imgOrigen.src : undefined;
  const S = cajaHoja();
  llenar(p, modoActual, fotoReal);

  if (!origen || !enPantalla(origen) || reducir()) {
    hoja.classList.remove('liquida');
    abrirDialogo();
    return;
  }
  ocupado = true;
  html.classList.add('bloqueo');
  hoja.classList.add('liquida', 'esperando');
  const o = cajaDe(origen);
  const vuelos: Promise<unknown>[] = [liquido.separar(o, RADIO[modoActual], S)];
  if (imgOrigen) {
    const destino = cajaImagenHoja(S, modoActual, imgOrigen);
    const desde = modoActual === 'foto' ? cajaDe(imgOrigen) : contenido(imgOrigen);
    vuelos.push(liquido.volar(imgOrigen.currentSrc || imgOrigen.src, modoActual === 'foto' ? 'cover' : 'contain', desde, destino,
      modoActual === 'foto' ? [`${RADIO.foto}px`, liquido.RADIO_HOJA] : ['0px', '0px']));
  }
  await Promise.all(vuelos);
  abrirDialogo();
  requestAnimationFrame(() => {
    hoja.classList.remove('esperando');
    liquido.limpiar();
    liquido.veloSin(false);
    ocupado = false;
  });
}

async function cerrar(sinLiquido = false) {
  if (!hoja.open || ocupado) return;
  const vuelve = () => { html.classList.remove('bloqueo'); disparador?.focus({ preventScroll: true }); };
  const visible = origen && enPantalla(origen);
  if (!sinLiquido && visible && !reducir() && origen) {
    ocupado = true;
    const S = cajaDe(panel);
    const o = cajaDe(origen);
    const imgOrigen = origen.querySelector<HTMLImageElement>('img[data-foto]');
    const desde = modoActual === 'foto' ? cajaDe(hojaImg) : contenido(hojaImg);
    const src = hojaImg.currentSrc || hojaImg.src;
    hoja.close();
    hoja.classList.remove('liquida');
    const pasos: Promise<unknown>[] = [liquido.fundir(S, o, RADIO[modoActual])];
    if (imgOrigen && modoActual !== 'fila') {
      const hasta = modoActual === 'foto' ? cajaDe(imgOrigen) : contenido(imgOrigen);
      pasos.push(liquido.volar(src, modoActual === 'foto' ? 'cover' : 'contain', desde, hasta, modoActual === 'foto' ? [liquido.RADIO_HOJA, `${RADIO.foto}px`] : ['0px', '0px'], 900, 0.04));
    }
    await Promise.all(pasos);
    liquido.limpiar();
    ocupado = false;
    vuelve();
    return;
  }
  const fin = () => { hoja.close(); hoja.classList.remove('cerrando', 'liquida'); panel.style.transform = ''; vuelve(); };
  if (sinLiquido || reducir()) { fin(); return; }
  hoja.classList.remove('liquida');
  hoja.classList.add('cerrando');
  await espera(300);
  fin();
}

document.addEventListener('click', (ev) => {
  const b = (ev.target as HTMLElement).closest<HTMLElement>('[data-abrir]');
  if (b) abrir(b.dataset.abrir!, b);
});
$('[data-cerrar]', hoja)!.addEventListener('click', () => cerrar());
hoja.addEventListener('cancel', (ev) => { ev.preventDefault(); cerrar(); });
hoja.addEventListener('click', (ev) => { if (ev.target === hoja) cerrar(); });

// Deslizar hacia abajo para cerrar (desde el asa o con el contenido arriba del todo).
let y0 = 0; let dy = 0; let arrastrando = false;
panel.addEventListener('pointerdown', (ev) => {
  const enAsa = !!(ev.target as HTMLElement).closest('.asa');
  if (ev.pointerType === 'mouse' && !enAsa) return;
  if (scroller.scrollTop > 0 && !enAsa) return;
  y0 = ev.clientY; dy = 0; arrastrando = true;
});
addEventListener('pointermove', (ev) => {
  if (!arrastrando) return;
  dy = Math.max(0, ev.clientY - y0);
  if (dy > 4) { panel.style.transition = 'none'; panel.style.transform = `translateY(${dy}px)`; }
});
addEventListener('pointerup', async () => {
  if (!arrastrando) return;
  arrastrando = false;
  if (dy > 110) {
    // Al soltar, la hoja regresa a la tarjeta como líquido desde donde quedó.
    panel.style.transition = '';
    if (origen && enPantalla(origen) && !reducir()) { cerrar(); requestAnimationFrame(() => (panel.style.transform = '')); }
    else { await panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(105%)' }], { duration: 220, easing: 'ease-in' }).finished; cerrar(true); }
  } else {
    panel.style.transition = 'transform 320ms cubic-bezier(0.34, 1.4, 0.64, 1)';
    panel.style.transform = '';
    setTimeout(() => (panel.style.transition = ''), 340);
  }
});

/* ── Inicio ─────────────────────────────────────────────────────────── */
aplicarIdioma();
setInterval(estado, 60_000);
