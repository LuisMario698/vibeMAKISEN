import { describe, expect, it } from 'vitest';
import { alzaArco, arcoEnso, azar, chispas, contadorVisible, etiquetaPedido, presion, rodillo, trazoEnso } from '../src/lib/detalle';

describe('ensō de pincel', () => {
  it('es un contorno cerrado con números válidos', () => {
    const d = trazoEnso();
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const nums = d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
    expect(nums.every(Number.isFinite)).toBe(true);
    // 97 puntos por borde × 2 bordes × 2 coordenadas
    expect(nums.length).toBe(97 * 2 * 2);
  });
  it('se queda dentro del lienzo de 200 × 200', () => {
    const nums = trazoEnso().replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
    expect(Math.min(...nums)).toBeGreaterThan(0);
    expect(Math.max(...nums)).toBeLessThan(200);
  });
  it('el pincel entra, se carga y termina seco (más delgado al final que en medio)', () => {
    expect(presion(0)).toBeLessThan(presion(0.1));
    expect(presion(1)).toBeLessThan(presion(0.3));
    expect(presion(1)).toBeGreaterThan(0);
  });
  it('es determinista', () => expect(trazoEnso({ grosor: 10 })).toBe(trazoEnso({ grosor: 10 })));
  it('el arco guía empieza donde empieza el trazo', () => {
    const a = arcoEnso();
    expect(a).toMatch(/^M[\d.]+ [\d.]+A84 84 0 0 1 [\d.]+ [\d.]+A84 84 0 0 1 [\d.]+ [\d.]+$/);
  });
});

describe('chispas doradas', () => {
  it('nunca más de 12 y nunca negativas', () => {
    expect(chispas(40, 100)).toHaveLength(12);
    expect(chispas(-3, 100)).toHaveLength(0);
    expect(chispas(7.8, 100)).toHaveLength(7);
  });
  it('nacen sobre el anillo y salen hacia afuera', () => {
    for (const c of chispas(12, 120, 3)) {
      expect(c.desde).toBeGreaterThanOrEqual(120 * 0.9);
      expect(c.hasta).toBeGreaterThan(c.desde);
      expect(c.angulo).toBeGreaterThanOrEqual(0);
      expect(c.angulo).toBeLessThan(360);
      expect(c.retraso).toBeLessThanOrEqual(90);
    }
  });
  it('misma semilla, mismas chispas', () => {
    expect(chispas(10, 90, 42)).toEqual(chispas(10, 90, 42));
    expect(chispas(10, 90, 42)).not.toEqual(chispas(10, 90, 43));
  });
  it('el azar queda entre 0 y 1', () => {
    const r = azar(1);
    for (let i = 0; i < 200; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('precio que rueda', () => {
  it('separa dígitos y signos', () => {
    expect(rodillo('$1,250')).toEqual([
      { tipo: 'texto', t: '$' }, { tipo: 'digito', v: 1 }, { tipo: 'texto', t: ',' },
      { tipo: 'digito', v: 2 }, { tipo: 'digito', v: 5 }, { tipo: 'digito', v: 0 },
    ]);
  });
  it('sin dígitos no rueda nada', () => expect(rodillo('—').every((p) => p.tipo === 'texto')).toBe(true));
});

describe('bolsa de Mi pedido', () => {
  it('el contador se limita a 99+', () => {
    expect(contadorVisible(0)).toBe('0');
    expect(contadorVisible(7)).toBe('7');
    expect(contadorVisible(99)).toBe('99');
    expect(contadorVisible(100)).toBe('99+');
  });
  it('etiqueta accesible en español e inglés, con singular y plural', () => {
    expect(etiquetaPedido(1, '$210', 'es')).toBe('Mi pedido: 1 artículo, $210');
    expect(etiquetaPedido(3, '$480', 'es')).toBe('Mi pedido: 3 artículos, $480');
    expect(etiquetaPedido(1, '$210', 'en')).toBe('My order: 1 item, $210');
    expect(etiquetaPedido(0, '$0', 'en')).toBe('My order: empty');
    expect(etiquetaPedido(0, '$0', 'es')).toBe('Mi pedido: vacío');
  });
  it('el arco siempre sube y tiene tope', () => {
    expect(alzaArco(0, 0)).toBe(56);
    expect(alzaArco(-300, 600)).toBe(150);
    expect(alzaArco(100, 300)).toBeGreaterThan(56);
    expect(alzaArco(100, 300)).toBeLessThanOrEqual(150);
  });
});
