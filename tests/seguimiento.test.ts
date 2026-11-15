import { describe, expect, it } from 'vitest';
import { ALFABETO_FOLIO, crearFolio, enlacePregunta, esFolio, etapaEstimada, sanearPedido, TIEMPOS, type PedidoEnviado } from '../src/lib/seguimiento';

const T0 = Date.UTC(2026, 10, 15, 2, 0);
const MIN = 60_000;

describe('folio', () => {
  it('formato MZ-XXXX con alfabeto sin caracteres ambiguos', () => {
    for (const c of '01OIL') expect(ALFABETO_FOLIO).not.toContain(c);
    for (let i = 0; i < 200; i++) expect(esFolio(crearFolio())).toBe(true);
    expect(crearFolio(() => 0)).toBe('MZ-2222');
    expect(crearFolio(() => 0.999999)).toBe('MZ-ZZZZ');
  });
  it('rechaza folios inválidos', () => {
    for (const f of ['MZ-0000', 'MZ-ABC', 'mz-4F7K', 'MZ-4F7KX', 'XX-4F7K', 'MZ-4F7O', '', 42, null]) expect(esFolio(f)).toBe(false);
    expect(esFolio('MZ-4F7K')).toBe(true);
  });
});

describe('etapaEstimada', () => {
  it('avanza con el tiempo y siempre empieza en Enviado', () => {
    expect(etapaEstimada('mesa', T0, T0).actual).toBe(0);
    expect(etapaEstimada('mesa', T0, T0 + (TIEMPOS.confirmacion + 0.5) * MIN).actual).toBe(1);
    expect(etapaEstimada('mesa', T0, T0 + 10 * MIN).actual).toBe(2);
    expect(etapaEstimada('mesa', T0, T0 + 60 * MIN).actual).toBe(3);
    const { etapas } = etapaEstimada('mesa', T0, T0);
    expect(etapas[0]).toMatchObject({ id: 'enviado', ms: T0, estimado: false });
    expect(etapas.slice(1).every((e) => e.estimado)).toBe(true);
  });
  it('la última etapa depende de la modalidad', () => {
    expect(etapaEstimada('mesa', T0, T0).etapas[3]!.id).toBe('servido');
    expect(etapaEstimada('llevar', T0, T0).etapas[3]!.id).toBe('listo');
    expect(etapaEstimada('domicilio', T0, T0).etapas[3]!.id).toBe('camino');
    expect(etapaEstimada('domicilio', T0, T0).etapas[3]!.ms).toBe(T0 + TIEMPOS.final.domicilio * MIN);
  });
  it('para llevar a una hora elegida, listo a esa hora (nunca antes del mínimo)', () => {
    expect(etapaEstimada('llevar', T0, T0, T0 + 90 * MIN).etapas[3]!.ms).toBe(T0 + 90 * MIN);
    expect(etapaEstimada('llevar', T0, T0, T0 + 5 * MIN).etapas[3]!.ms).toBe(T0 + TIEMPOS.final.llevar * MIN);
  });
  it('los tiempos van en orden', () => {
    for (const m of ['mesa', 'llevar', 'domicilio'] as const) {
      const ms = etapaEstimada(m, T0, T0).etapas.map((e) => e.ms);
      expect([...ms].sort((a, b) => a - b)).toEqual(ms);
    }
  });
});

describe('pedido enviado guardado', () => {
  const bueno: PedidoEnviado = {
    v: 1, t: T0, folio: 'MZ-4F7K', modo: 'mesa', total: 640, mesa: 7, hora: 'pronto', pago: 'efectivo', paga: 1000,
    url: 'https://wa.me/526381560660?text=hola', lineas: [{ n: 2, nombre: { es: 'Makizen Roll', en: 'Makizen Roll' } }],
  };
  it('acepta lo válido', () => { expect(sanearPedido(bueno, T0 + MIN)).toEqual(bueno); });
  it('caduca a las 12 h y rechaza lo corrupto', () => {
    expect(sanearPedido(bueno, T0 + 12 * 3600_000 + 1)).toBeNull();
    expect(sanearPedido({ ...bueno, v: 2 }, T0)).toBeNull();
    expect(sanearPedido({ ...bueno, folio: 'X' }, T0)).toBeNull();
    expect(sanearPedido({ ...bueno, url: 'https://malo.example/?q=1' }, T0)).toBeNull();
    expect(sanearPedido({ ...bueno, lineas: [] }, T0)).toBeNull();
    expect(sanearPedido('basura', T0)).toBeNull();
  });
  it('limpia campos dudosos', () => {
    const r = sanearPedido({ ...bueno, mesa: 400, pago: 'bitcoin', paga: -1, hora: 'mañana', lineas: [{ n: 99, nombre: { es: 'a', en: 'a' } }, { n: 1, nombre: { es: 'Té', en: 'Tea' }, nota: 'x'.repeat(200) }] }, T0);
    expect(r).toMatchObject({ mesa: null, pago: '', paga: null, hora: 'pronto' });
    expect(r!.lineas).toHaveLength(1);
    expect(r!.lineas[0]!.nota).toHaveLength(80);
  });
  it('enlace para preguntar con el folio', () => {
    const u = new URL(enlacePregunta('526381560660', 'MZ-4F7K', 'es'));
    expect(u.origin + u.pathname).toBe('https://wa.me/526381560660');
    expect(u.searchParams.get('text')).toContain('MZ-4F7K');
    expect(new URL(enlacePregunta('526381560660', 'MZ-4F7K', 'en')).searchParams.get('text')).toContain('my order MZ-4F7K');
  });
});
