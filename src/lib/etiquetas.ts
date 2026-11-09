// Etiquetas del platillo: siempre icono + texto (nunca solo color).
// Se usa igual en el servidor (Astro) y en el navegador (hoja de detalle).
import type { Platillo } from '../data/schema';

const svg = (d: string, extra = '') =>
  `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const iconos = {
  chile: (on: boolean, c: number) =>
    `<svg class="chile ${on ? 'on' : ''}" style="--c:${c}" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M14.5 4.2c.9-.9 2.3-1 3.2-.2" fill="none" stroke="${on ? '#6fbf73' : 'currentColor'}" stroke-width="1.8" stroke-linecap="round"/><path d="M16.8 6.5c2 1.7 1.6 5.4-.9 8.6-2.6 3.3-6.6 5.3-10.4 5.6-1 .1-1.2-1.2-.3-1.6 3.3-1.6 5.4-4 6.6-7.2.8-2.2 1.5-4 2.6-5 .7-.6 1.7-.9 2.4-.4z" fill="${on ? 'var(--color-chile)' : 'transparent'}" stroke="${on ? 'var(--color-chile)' : 'currentColor'}" stroke-width="1.6" opacity="${on ? 1 : 0.45}"/></svg>`,
  crudo: svg('<path d="M3 12c3-4 7-5 11-3l4-3v12l-4-3c-4 2-8 1-11-3z"/><circle cx="8" cy="11" r=".6" fill="currentColor"/>'),
  empanizado: svg('<circle cx="7" cy="8" r="1.4"/><circle cx="14" cy="6" r="1.1"/><circle cx="17" cy="12" r="1.6"/><circle cx="9" cy="15" r="1.2"/><circle cx="14" cy="18" r="1"/><circle cx="5" cy="17" r=".9"/>'),
  capeado: svg('<path d="M4 15c0-4.5 3.6-8 8-8s8 3.5 8 8"/><path d="M3 15h18"/><path d="M8 18h8"/>'),
  natural: svg('<path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14z"/><path d="M5 19 13 11"/>'),
  horneado: svg('<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.6.7-2.6 1.5-3.5.3 1.4 1 2 1.8 2.2C11 8 11 5.5 12 3z"/><path d="M5 21h14"/>'),
  favorito: svg('<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>'),
  nuevo: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  agotado: svg('<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>'),
};

type Tono = 'oro' | 'neutro' | 'chile' | 'gris';
type Etiqueta = { clave: string; icono: string; es: string; en: string; tono: Tono };

const PICANTE = [
  null,
  { es: 'Poco picante', en: 'Mild' },
  { es: 'Picante', en: 'Spicy' },
  { es: 'Muy picante', en: 'Very spicy' },
] as const;

const PREP = {
  natural: { es: 'Natural', en: 'Not fried', icono: iconos.natural },
  empanizado: { es: 'Empanizado', en: 'Breaded', icono: iconos.empanizado },
  horneado: { es: 'Horneado', en: 'Baked', icono: iconos.horneado },
  capeado: { es: 'Capeado', en: 'Battered', icono: iconos.capeado },
} as const;

export function etiquetasDe(p: Platillo): Etiqueta[] {
  const out: Etiqueta[] = [];
  if (p.agotado) out.push({ clave: 'agotado', icono: iconos.agotado, es: 'Agotado', en: 'Sold out', tono: 'gris' });
  if (p.etiquetas.includes('favorito')) out.push({ clave: 'favorito', icono: iconos.favorito, es: 'Favorito', en: 'Favorite', tono: 'oro' });
  if (p.etiquetas.includes('nuevo')) out.push({ clave: 'nuevo', icono: iconos.nuevo, es: 'Nuevo', en: 'New', tono: 'oro' });
  const pic = PICANTE[p.picante];
  if (pic) {
    const chiles = [1, 2, 3].map((n) => iconos.chile(n <= p.picante, n)).join('');
    out.push({ clave: 'picante', icono: `<span class="inline-flex -space-x-1">${chiles}</span>`, es: `${pic.es} ${p.picante}/3`, en: `${pic.en} ${p.picante}/3`, tono: 'chile' });
  }
  if (p.crudo) out.push({ clave: 'crudo', icono: iconos.crudo, es: 'Crudo / curtido', en: 'Raw / cured', tono: 'neutro' });
  if (p.preparacion) {
    const pr = PREP[p.preparacion];
    out.push({ clave: p.preparacion, icono: pr.icono, es: pr.es, en: pr.en, tono: 'neutro' });
  }
  return out;
}

const TONO: Record<Tono, string> = {
  oro: 'border-oro/60 text-oro-claro bg-oro/10',
  neutro: 'border-white/15 text-niebla',
  chile: 'border-chile/40 text-[#ffb4a3]',
  gris: 'border-white/30 text-hueso bg-white/10',
};

export function etiquetasHTML(p: Platillo): string {
  return etiquetasDe(p)
    .map(
      (e) =>
        `<li class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] leading-none ${TONO[e.tono]}">${e.icono}<span lang="es">${e.es}</span><span lang="en">${e.en}</span></li>`,
    )
    .join('');
}

/** La etiqueta más importante en versión compacta (icono + texto) para la rejilla. */
export function etiquetaCorta(p: Platillo): string {
  const e = etiquetasDe(p).find((x) => x.clave !== 'agotado' && ['favorito', 'picante', 'crudo', 'nuevo'].includes(x.clave));
  if (!e) return '';
  const corto = e.clave === 'picante' ? { es: 'Picante', en: 'Spicy' } : e.clave === 'crudo' ? { es: 'Crudo', en: 'Raw' } : { es: e.es, en: e.en };
  return `${e.icono}<span lang="es">${corto.es}</span><span lang="en">${corto.en}</span>`;
}

const mxn = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });
/** "$1,100" como en la cartilla (MXN con IVA incluido). */
export const precio = (n: number) => `$${mxn.format(n)}`;
/** "≈ US$11": solo referencia, nunca precio de cobro. */
export const usd = (n: number, tc: number) => `≈ US$${Math.max(1, Math.round(n / tc))}`;
