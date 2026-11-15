import { describe, expect, it } from 'vitest';
import { alzaArco, arcoEnso, azar, chispas, contadorVisible, etiquetaPedido, presion, rodillo, trazoEnso } from '../src/lib/detalle';
import { curva, duracionVuelo, LLEGA, trayectoria } from '../src/scripts/morfo';

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

describe('vuelo a la bolsa', () => {
  it('la curva cúbica respeta extremos, es monótona y coincide con valores conocidos', () => {
    const f = curva(0.3, 0.3, 0.7, 0.75);
    expect(f(0)).toBe(0);
    expect(f(1)).toBe(1);
    expect(f(-1)).toBe(0);
    expect(f(2)).toBe(1);
    let antes = 0;
    for (let i = 1; i <= 100; i++) { const v = f(i / 100); expect(v).toBeGreaterThanOrEqual(antes - 1e-9); antes = v; }
    // cubic-bezier(0.25, 0.1, 0.25, 1) es «ease»: en x = 0.5 vale ≈ 0.8024.
    expect(curva(0.25, 0.1, 0.25, 1)(0.5)).toBeCloseTo(0.8024, 3);
    // La lineal es la identidad.
    expect(curva(0, 0, 1, 1)(0.37)).toBeCloseTo(0.37, 4);
  });
  it('sale del origen, sube por encima de ambos extremos y entra en la bolsa', () => {
    const dx = -120, dy = -390, alza = 40;
    const p = trayectoria(dx, dy, 4, alza);
    const a = p[0]!, z = p[p.length - 1]!;
    expect(a.t).toBe(0);
    expect(a.x).toBeCloseTo(dx);
    expect(a.y).toBeCloseTo(dy);
    expect(a.k).toBeCloseTo(4);
    expect(z.t).toBe(1);
    expect(z.x).toBe(0);
    expect(z.o).toBe(0);
    // Llega a la boca (0, 0) con escala 1 justo en LLEGA.
    const boca = p.find((q) => q.t === LLEGA)!;
    expect(boca.x).toBeCloseTo(0);
    expect(boca.y).toBeCloseTo(0);
    expect(boca.k).toBeCloseTo(1);
    // La cima queda alrededor de `alza` px por encima del extremo más alto.
    const cima = Math.min(...p.map((q) => q.y));
    expect(cima).toBeLessThan(Math.min(dy, 0) - alza * 0.9);
    expect(cima).toBeGreaterThan(Math.min(dy, 0) - alza * 1.1);
    // También si sale por debajo de la bolsa.
    const abajo = trayectoria(80, 300, 1, 100);
    expect(Math.min(...abajo.map((q) => q.y))).toBeCloseTo(-100, -1);
  });
  it('el tiempo crece y el horizontal avanza siempre hacia la bolsa (sin frenarse en la cima)', () => {
    const p = trayectoria(300, -200, 2, 60).filter((q) => q.t <= LLEGA);
    for (let i = 1; i < p.length; i++) {
      expect(p[i]!.t).toBeGreaterThan(p[i - 1]!.t);
      expect(p[i]!.x).toBeLessThan(p[i - 1]!.x);
    }
    // Ningún tramo se queda casi quieto: el paso más corto es al menos 1/4 del promedio.
    const pasos = p.slice(1).map((q, i) => Math.hypot(q.x - p[i]!.x, q.y - p[i]!.y));
    const media = pasos.reduce((s, v) => s + v, 0) / pasos.length;
    expect(Math.min(...pasos)).toBeGreaterThan(media / 4);
  });
  it('la moneda nace con un fundido; el recorte sale opaco', () => {
    expect(trayectoria(100, -100, 2, 40, 18, true)[0]!.o).toBe(0);
    expect(trayectoria(100, -100, 2, 40)[0]!.o).toBe(1);
  });
  it('sin desplazamiento horizontal no gira', () => {
    expect(trayectoria(0, -300, 2, 40).every((q) => q.r === 0)).toBe(true);
  });
  it('la duración depende de la distancia, con tope abajo y arriba', () => {
    expect(duracionVuelo(0)).toBe(420);
    expect(duracionVuelo(5000)).toBe(580);
    expect(duracionVuelo(400)).toBeGreaterThan(420);
    expect(duracionVuelo(400)).toBeLessThan(580);
  });
});
