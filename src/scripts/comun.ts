// Utilidades del navegador compartidas por los módulos del menú.
import type { Platillo } from '../data/schema';
import type { Horario } from '../lib/horario';
import { escapar } from '../lib/texto';

export type Txt = { es: string; en: string };
export type Foto = { src: string; srcset: string; w: number; h: number };
export type PlatilloCliente = Platillo & { cat: Txt; catId: string };
export type Datos = {
  tc: number;
  tcFecha: string;
  whatsapp: string;
  telefonoFijo: string;
  horario: Horario[];
  fotos: Record<string, [number, number]>;
  /** Recortes con variante ligera de 240 px (miniaturas de la isla, el pedido y el aviso). */
  mini: string[];
  reales: Record<string, Foto>;
  cats: { id: string; nombre: Txt }[];
  platillos: PlatilloCliente[];
  iconos: Record<string, string>;
};

export const datos: Datos = JSON.parse(document.getElementById('datos-menu')!.textContent!);
const conMini = new Set(datos.mini ?? []);
/** URL ligera de un recorte para miniaturas (≤ 60 px): variante de 240 px si existe. */
export const miniRecorte = (id: string) => (conMini.has(id) ? `/menu/v/${id}-240.webp` : `/menu/${id}.webp`);
export const html = document.documentElement;
export const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);
export const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
export const reducir = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esIngles = () => html.lang === 'en';
export const idioma = (): 'es' | 'en' => (esIngles() ? 'en' : 'es');
export const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const enPantalla = (el: Element | null | undefined) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.bottom > 40 && r.top < innerHeight - 40;
};

/** Texto bilingüe para innerHTML, siempre escapado. */
export const bi = (t: Txt | string, en?: string) => {
  const es = typeof t === 'string' ? t : t.es;
  const ing = typeof t === 'string' ? (en ?? t) : t.en;
  return `<span lang="es">${escapar(es)}</span><span lang="en">${escapar(ing)}</span>`;
};

/** Pone texto bilingüe en un elemento sin usar innerHTML con datos del usuario. */
export function ponerBi(el: Element, es: string, en: string = es) {
  const a = document.createElement('span'); a.lang = 'es'; a.textContent = es;
  const b = document.createElement('span'); b.lang = 'en'; b.textContent = en;
  el.replaceChildren(a, b);
}

/** Región aria-live para anunciar cambios (agregado a la lista, avisos). */
export function anunciar(es: string, en: string = es) {
  const r = $('#anuncio');
  if (!r) return;
  r.textContent = '';
  requestAnimationFrame(() => (r.textContent = esIngles() ? en : es));
}

/** Aviso visible unos segundos (y anunciado al lector de pantalla). */
let tAviso = 0;
export function avisar(es: string, en: string = es) {
  anunciar(es, en);
  const el = $('#aviso-flotante');
  if (!el) return;
  ponerBi(el, es, en);
  el.hidden = false;
  el.classList.remove('sale');
  clearTimeout(tAviso);
  tAviso = window.setTimeout(() => { el.classList.add('sale'); tAviso = window.setTimeout(() => { el.hidden = true; el.classList.remove('sale'); }, 200); }, 3200);
}

export const guardar = {
  leer(k: string, sesion = false): string | null { try { return (sesion ? sessionStorage : localStorage).getItem(k); } catch { return null; } },
  escribir(k: string, v: string, sesion = false) { try { (sesion ? sessionStorage : localStorage).setItem(k, v); } catch { /* sin almacenamiento: vive en memoria */ } },
  borrar(k: string, sesion = false) { try { (sesion ? sessionStorage : localStorage).removeItem(k); } catch { /* nada */ } },
};

/** Desde computadora el detalle y la lista cambian de forma (modal y cajón). */
export const esEscritorio = () => matchMedia('(min-width: 64rem) and (min-height: 36rem)').matches;
export const esTablet = () => matchMedia('(min-width: 40rem)').matches && !esEscritorio();
