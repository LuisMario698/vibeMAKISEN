// Imágenes de las tarjetas: srcset / sizes del tamaño justo para cada uso (ver scripts/miniaturas.mjs).

/** srcset de un recorte: variantes de public/menu/v/ y el original como la opción más grande. */
export function srcsetRecorte(id: string, ancho: number, anchos: readonly number[]): string {
  const v = anchos.filter((a) => a < ancho).map((a) => `/menu/v/${id}-${a}.webp ${a}w`);
  return [...v, `/menu/${id}.webp ${ancho}w`].join(', ');
}

const r = (n: number) => Math.round(n * 1000) / 1000;

/**
 * sizes de un recorte en la rejilla de tarjetas: ancho de la columna × 84 % (la caja de la imagen)
 * × la proporción del platillo cuando es más alto que ancho (object-contain en una caja cuadrada).
 * Columnas: 2 en teléfono, 3 desde 40rem, 4 desde 64rem (contenido = 100vw − 20rem, tope 1056 px).
 */
export function sizesRecorte(ancho: number, alto: number): string {
  const a = Math.min(1, ancho / Math.max(1, alto));
  const f = (cols: number) => r((0.84 / cols) * a);
  return [
    `(min-width: 86rem) ${Math.round(((1056 - 36) / 4) * 0.84 * a)}px`,
    `(min-width: 64rem) calc((100vw - 20rem - 36px) * ${f(4)})`,
    `(min-width: 40rem) calc((100vw - 2rem - 24px) * ${f(3)})`,
    `calc((100vw - 2rem - 12px) * ${f(2)})`,
  ].join(', ');
}

/** sizes de un recorte en una fila de lista (miniatura de 64 px al 86 %). */
export function sizesFila(ancho: number, alto: number): string {
  return `${Math.ceil(64 * 0.86 * Math.min(1, ancho / Math.max(1, alto)))}px`;
}
