// Fotografía real tomada de las publicaciones y reels de @makizen.puertopenasco
// (ver scripts/prepare-fotos-redes.mjs). Solo se asocia a un platillo cuando la
// foto corresponde claramente a la descripción de la cartilla.
import tam from './fotos-redes.json';

export type FotoReal = { src: string; w: number; h: number };
const T = tam as Record<string, { w: number; h: number; origen: string }>;
export const foto = (id: string): FotoReal => {
  const t = T[id];
  if (!t) throw new Error(`Falta la foto ${id}`);
  return { src: `/fotos/${id}.webp`, w: t.w, h: t.h };
};

/** Portada (banner) de algunas categorías. */
export const portadas: Record<string, { foto: string; lema: { es: string; en: string } }> = {
  entradas: { foto: 'sashimi-real', lema: { es: 'Para abrir boca', en: 'To get started' } },
  'tostadas-aguachiles': { foto: 'aguachile-real', lema: { es: 'Curtido en limón, al estilo Sinaloa', en: 'Lime-cured, Sinaloa style' } },
  'rollos-naturales': { foto: 'rollos-corona', lema: { es: 'El antojo tiene otra forma', en: 'Cravings take a new shape' } },
  'rollos-empanizados': { foto: 'serrano-real', lema: { es: 'Un bocado y cambia todo', en: 'One bite changes everything' } },
  'rollos-especiales': { foto: 'mas-sabores', lema: { es: 'Más sabores, más razones para volver', en: 'More flavors, more reasons to come back' } },
  guisos: { foto: 'udon-real', lema: { es: 'Del wok a tu mesa', en: 'From the wok to your table' } },
  mixologia: { foto: 'muro-logo', lema: { es: 'Para brindar', en: 'Time for a toast' } },
};

/** Foto real del platillo servido (se muestra en el detalle). */
export const realDe: Record<string, string> = {
  'aguachile-mixto': 'aguachile-real',
  'makizen-roll': 'makizen-roll-real',
  'res-udon': 'udon-real',
  'serrano-roll': 'serrano-real',
  'sashimi-mixto': 'sashimi-real',
  'gin-pepino': 'gin-pepino-real',
};

/** Carrusel "Lo más pedido": lo que más mencionan las reseñas y tiene foto real. */
export const destacados: { id: string; foto: string }[] = [
  { id: 'aguachile-mixto', foto: 'aguachile-real' },
  { id: 'makizen-roll', foto: 'makizen-roll-real' },
  { id: 'serrano-roll', foto: 'serrano-palillos' },
  { id: 'sashimi-mixto', foto: 'sashimi-real' },
  { id: 'res-udon', foto: 'udon-real' },
];

/** Portada de la página: se alternan como historias. */
export const portadaHero = ['mesa-cenital', 'fachada-atardecer', 'muro-logo', 'rollos-corona'];
