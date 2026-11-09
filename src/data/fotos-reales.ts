// Fotografía real de @makizen.puertopenasco en resolución original
// (ver scripts/prepare-fotos-redes.mjs). Solo se asocia a un platillo cuando la
// foto corresponde claramente a la descripción de la cartilla.
import tam from './fotos-redes.json';

type Info = { w: number; h: number; anchos: number[]; origen: string };
const T = tam as Record<string, Info>;
export type Foto = { src: string; srcset: string; w: number; h: number };

export const foto = (id: string): Foto => {
  const t = T[id];
  if (!t) throw new Error(`Falta la foto ${id}`);
  const max = t.anchos[t.anchos.length - 1];
  return { src: `/fotos/${id}-${max}.webp`, srcset: t.anchos.map((a) => `/fotos/${id}-${a}.webp ${a}w`).join(', '), w: t.w, h: t.h };
};

/** Foto de cabecera de algunas categorías. */
export const portadas: Record<string, string> = {
  'tostadas-aguachiles': 'aguachile',
  'rollos-naturales': 'rollo-corona',
  'rollos-empanizados': 'serrano',
  'rollos-especiales': 'mas-sabores',
  guisos: 'udon',
  mixologia: 'muro-coctel',
};

/** Foto real del platillo servido (se muestra en el detalle). */
export const realDe: Record<string, string> = {
  'aguachile-mixto': 'aguachile',
  'makizen-roll': 'makizen-roll',
  'res-udon': 'udon',
  'serrano-roll': 'serrano',
  'sashimi-mixto': 'sashimi',
  'gin-pepino': 'gin-pepino',
};

/** Foto real que se usa como imagen de la tarjeta cuando el platillo no tiene recorte en la cartilla. */
export const fotoTarjeta: Record<string, string> = {
  'res-udon': 'udon',
};

/** Mosaico "Lo más pedido": lo que más mencionan las reseñas y tiene foto real. */
export const favoritos: { id: string; foto: string; forma: 'alta' | 'normal' | 'ancha' }[] = [
  { id: 'aguachile-mixto', foto: 'aguachile', forma: 'alta' },
  { id: 'makizen-roll', foto: 'makizen-roll', forma: 'normal' },
  { id: 'sashimi-mixto', foto: 'sashimi', forma: 'normal' },
  { id: 'serrano-roll', foto: 'serrano', forma: 'ancha' },
];
