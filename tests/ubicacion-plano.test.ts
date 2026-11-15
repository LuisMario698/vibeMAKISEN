import { describe, expect, it } from 'vitest';
import { estadoMesa, mesaValida, posicion, puedeElegir, type PlanoMesas } from '../src/lib/plano';
import { coordValida, distanciaKm, enlaceUbicacion, lejos, sanearCoord } from '../src/lib/ubicacion';
import { plano } from '../src/data/schema';

describe('ubicación de entrega', () => {
  it('enlace de Google Maps con 6 decimales', () => {
    expect(enlaceUbicacion({ lat: 31.3157, lng: -113.5286 })).toBe('https://maps.google.com/?q=31.315700,-113.528600');
    expect(enlaceUbicacion({ lat: 31.3157004, lng: -113.5286006 })).toBe('https://maps.google.com/?q=31.315700,-113.528601');
  });
  it('valida y sanea coordenadas', () => {
    expect(coordValida({ lat: 31.3, lng: -113.5 })).toBe(true);
    for (const c of [null, {}, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: '31', lng: '-113' }]) expect(coordValida(c)).toBe(false);
    expect(sanearCoord({ lat: 31.123456789, lng: -113.987654321 })).toEqual({ lat: 31.123457, lng: -113.987654 });
    expect(sanearCoord('x')).toBeNull();
  });
  it('distancia y aviso de lejanía', () => {
    const local = { lat: 31.3157, lng: -113.5286 };
    expect(distanciaKm(local, local)).toBe(0);
    // Puerto Peñasco → Hermosillo: más de 300 km.
    expect(distanciaKm(local, { lat: 29.0729, lng: -110.9559 })).toBeGreaterThan(300);
    expect(lejos({ lat: 31.33, lng: -113.55 }, local)).toBe(false);
    expect(lejos({ lat: 33.4484, lng: -112.074 }, local)).toBe(true);
  });
});

describe('plano de mesas', () => {
  const p: PlanoMesas = {
    ancho: 100, alto: 200, ocupadasDemo: [2],
    mesas: [
      { n: 1, x: 50, y: 50, forma: 'redonda', personas: 2, zona: { es: 'Ventana', en: 'Window' } },
      { n: 2, x: 25, y: 100, forma: 'cuadrada', personas: 4, zona: { es: 'Salón', en: 'Dining room' } },
    ],
  };
  it('estado de cada mesa', () => {
    expect(estadoMesa(p, 1)).toBe('libre');
    expect(estadoMesa(p, 2)).toBe('ocupada');
    expect(estadoMesa(p, 40)).toBe('fuera');
  });
  it('se eligen libres; desde el QR se acepta cualquier mesa 1–99', () => {
    expect(puedeElegir(p, 1)).toBe(true);
    expect(puedeElegir(p, 2)).toBe(false);
    expect(puedeElegir(p, 2, true)).toBe(true);
    expect(puedeElegir(p, 40, true)).toBe(true);
    expect(puedeElegir(p, 0, true)).toBe(false);
    expect(puedeElegir(p, 100)).toBe(false);
    expect(mesaValida(7.5)).toBe(false);
  });
  it('posición relativa del botón', () => {
    expect(posicion(p, p.mesas[1]!)).toEqual({ left: 25, top: 50 });
  });
  it('el plano real es válido: números únicos y ocupadas que existen', () => {
    expect(plano.mesas.length).toBeGreaterThanOrEqual(10);
    expect(new Set(plano.mesas.map((m) => m.n)).size).toBe(plano.mesas.length);
    for (const n of plano.ocupadasDemo) expect(estadoMesa(plano, n)).toBe('ocupada');
    for (const m of plano.mesas) { expect(m.x).toBeLessThan(plano.ancho); expect(m.y).toBeLessThan(plano.alto); }
  });
});
