import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { sizesFila, sizesRecorte, srcsetRecorte } from '../src/lib/imagenes';
import mini from '../src/data/miniaturas.json';

describe('srcset de recortes', () => {
  it('variantes menores y el original como opción más grande', () => {
    expect(srcsetRecorte('makizen-roll', 560, [240, 360])).toBe('/menu/v/makizen-roll-240.webp 240w, /menu/v/makizen-roll-360.webp 360w, /menu/makizen-roll.webp 560w');
  });
  it('omite variantes que no son menores que el original', () => {
    expect(srcsetRecorte('sapporo', 121, [240])).toBe('/menu/sapporo.webp 121w');
  });
});

describe('sizes de recortes', () => {
  it('platillo ancho: la caja completa (84 % de la columna)', () => {
    const s = sizesRecorte(560, 319);
    expect(s).toContain('calc((100vw - 2rem - 12px) * 0.42)');
    expect(s).toContain('(min-width: 86rem) 214px');
  });
  it('platillo alto: proporcional a su ancho', () => {
    expect(sizesRecorte(316, 560)).toContain('calc((100vw - 2rem - 12px) * 0.237)');
  });
  it('fila: miniatura de 64 px', () => {
    expect(sizesFila(502, 502)).toBe('56px');
    expect(sizesFila(121, 285)).toBe('24px');
  });
});

describe('miniaturas generadas', () => {
  const M = mini as unknown as { sombraEscala: number; recortes: Record<string, { anchos: number[]; lqip: string; sombra: string }>; fotos: Record<string, { lqip: string }> };
  it('cada recorte tiene LQIP y sombra en línea, ligeros', () => {
    for (const [id, r] of Object.entries(M.recortes)) {
      expect(r.lqip, id).toMatch(/^data:image\/webp;base64,/);
      expect(r.sombra, id).toMatch(/^data:image\/webp;base64,/);
      expect(r.lqip.length + r.sombra.length, id).toBeLessThan(1400);
      for (const a of r.anchos) expect(existsSync(`public/menu/v/${id}-${a}.webp`), `${id}-${a}`).toBe(true);
    }
  });
  it('la escala de la sombra corresponde al margen del lienzo', () => {
    expect(M.sombraEscala).toBeGreaterThan(1.4);
    expect(M.sombraEscala).toBeLessThan(1.8);
  });
});
