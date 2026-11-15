import { describe, expect, it } from 'vitest';
import { cambio, dondeTerminal, lineaPago, montosSugeridos, montoValido, pagaCubre, PAGA_MAXIMA, sanearPaga } from '../src/lib/pago';

describe('pago en efectivo', () => {
  it('el monto debe cubrir el total (exacto o sin decir también valen)', () => {
    expect(pagaCubre(1000, 640)).toBe(true);
    expect(pagaCubre(640, 640)).toBe(true);
    expect(pagaCubre(500, 640)).toBe(false);
    expect(pagaCubre('exacto', 640)).toBe(true);
    expect(pagaCubre(null, 640)).toBe(true);
  });
  it('calcula el cambio', () => {
    expect(cambio(1000, 640)).toBe(360);
    expect(cambio(640, 640)).toBe(0);
    expect(cambio(500, 640)).toBe(0);
    expect(cambio('exacto', 640)).toBe(0);
    expect(cambio(null, 640)).toBe(0);
  });
  it('sugiere montos redondos mayores al total, sin repetir', () => {
    expect(montosSugeridos(640)).toEqual([700, 800, 1000]);
    expect(montosSugeridos(240)).toEqual([300, 400, 500]);
    expect(montosSugeridos(500)).toEqual([600, 1000, 1500]);
    expect(montosSugeridos(1850)).toEqual([1900, 2000, 2500]);
    for (const t of [1, 99, 640, 1234, 5000]) for (const m of montosSugeridos(t)) expect(m).toBeGreaterThan(t);
    expect(montosSugeridos(0)).toEqual([]);
  });
  it('sanea montos guardados', () => {
    expect(sanearPaga('exacto')).toBe('exacto');
    expect(sanearPaga(1000)).toBe(1000);
    for (const v of [0, -5, 1.5, PAGA_MAXIMA + 1, '1000', NaN, Infinity, {}, undefined]) expect(sanearPaga(v)).toBeNull();
    expect(montoValido(PAGA_MAXIMA)).toBe(true);
  });
});

describe('línea de pago del mensaje', () => {
  it('efectivo con monto, exacto y sin decir', () => {
    expect(lineaPago('efectivo', 1000, 'mesa', 640, 'es')).toBe('Pago: efectivo, paga con $1,000 (cambio: $360)');
    expect(lineaPago('efectivo', 640, 'llevar', 640, 'es')).toBe('Pago: efectivo, paga con $640');
    expect(lineaPago('efectivo', 'exacto', 'mesa', 640, 'es')).toBe('Pago: efectivo (exacto)');
    expect(lineaPago('efectivo', null, 'mesa', 640, 'es')).toBe('Pago: efectivo');
    expect(lineaPago('efectivo', 1000, 'domicilio', 640, 'es')).toBe('Pago: efectivo, paga con $1,000 (cambio antes del envío: $360)');
  });
  it('tarjeta: dónde está la terminal según la modalidad', () => {
    expect(lineaPago('tarjeta', null, 'mesa', 640, 'es')).toBe('Pago: tarjeta (terminal en la mesa)');
    expect(lineaPago('tarjeta', 1000, 'llevar', 640, 'es')).toBe('Pago: tarjeta (terminal en caja)');
    expect(lineaPago('tarjeta', null, 'domicilio', 640, 'es')).toBe('Pago: tarjeta (terminal al recibir)');
    expect(dondeTerminal('domicilio', 'en')).toBe('card terminal on delivery');
  });
  it('en inglés y sin forma de pago', () => {
    expect(lineaPago('efectivo', 1000, 'mesa', 640, 'en')).toBe('Payment: cash, paying with $1,000 (change: $360)');
    expect(lineaPago('tarjeta', null, 'llevar', 640, 'en')).toBe('Payment: card (card terminal at the counter)');
    expect(lineaPago('', null, 'mesa', 640, 'es')).toBe('');
  });
});
