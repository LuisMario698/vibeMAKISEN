import { describe, expect, it } from 'vitest';
import { ahoraEn, estadoLocal, h12, hhmm, minutos, ranurasHoy, type Horario } from '../src/lib/horario';

// Horario real: Lun, Mié, Jue 13–21 · Vie, Sáb, Dom 13–22 · martes cerrado.
const H: Horario[] = [
  { dia: 1, abre: '13:00', cierra: '21:00' }, { dia: 3, abre: '13:00', cierra: '21:00' }, { dia: 4, abre: '13:00', cierra: '21:00' },
  { dia: 5, abre: '13:00', cierra: '22:00' }, { dia: 6, abre: '13:00', cierra: '22:00' }, { dia: 0, abre: '13:00', cierra: '22:00' },
];
const t = (dia: number, hm: string) => ({ dia, min: minutos(hm) });

describe('formato de horas', () => {
  it('h12 corto y completo', () => {
    expect(h12('13:00')).toBe('1 pm');
    expect(h12('21:30')).toBe('9:30 pm');
    expect(h12('00:15')).toBe('12:15 am');
    expect(h12('12:00')).toBe('12 pm');
    expect(h12('13:00', true)).toBe('1:00 pm');
  });
  it('hhmm', () => { expect(hhmm(810)).toBe('13:30'); expect(hhmm(0)).toBe('00:00'); });
});

describe('estadoLocal', () => {
  it('abierto entre la apertura y el cierre', () => {
    const e = estadoLocal(H, t(1, '15:00'));
    expect(e.abierto).toBe(true);
    expect(e.texto.es).toBe('Abierto ahora · cierra 9 pm');
    expect(e.texto.en).toBe('Open now · closes 9 pm');
  });
  it('a las 12:59 abre hoy', () => {
    const e = estadoLocal(H, t(1, '12:59'));
    expect(e.abierto).toBe(false);
    expect(e.texto.es).toBe('Cerrado · abre hoy 1 pm');
  });
  it('a la hora exacta de cierre ya está cerrado', () => {
    expect(estadoLocal(H, t(4, '21:00')).abierto).toBe(false);
  });
  it('lunes después de cerrar abre el miércoles (martes cerrado)', () => {
    const e = estadoLocal(H, t(1, '21:30'));
    expect(e.texto.es).toBe('Cerrado · abre el miércoles 1 pm');
    expect(e.texto.en).toBe('Closed · opens Wednesday 1 pm');
  });
  it('martes todo el día cerrado, abre mañana', () => {
    const e = estadoLocal(H, t(2, '15:00'));
    expect(e.abierto).toBe(false);
    expect(e.hoy).toBeUndefined();
    expect(e.texto.es).toBe('Cerrado · abre mañana 1 pm');
  });
  it('domingo después de cerrar abre mañana (lunes)', () => {
    expect(estadoLocal(H, t(0, '22:30')).texto.en).toBe('Closed · opens tomorrow 1 pm');
  });
});

describe('ahoraEn (Sonora, sin horario de verano)', () => {
  it('UTC−7 en enero', () => {
    // Miércoles 14 ene 2026, 20:00 UTC = 13:00 en Sonora.
    expect(ahoraEn(new Date('2026-01-14T20:00:00Z'))).toEqual({ dia: 3, min: 13 * 60 });
  });
  it('UTC−7 también en julio', () => {
    // Miércoles 15 jul 2026, 20:00 UTC = 13:00 en Sonora (no cambia en verano).
    expect(ahoraEn(new Date('2026-07-15T20:00:00Z'))).toEqual({ dia: 3, min: 13 * 60 });
  });
  it('medianoche cuenta como minuto 0', () => {
    expect(ahoraEn(new Date('2026-01-15T07:00:00Z')).min).toBe(0);
  });
});

describe('ranurasHoy', () => {
  it('desde 20 min después, redondeado a 15, hasta 15 min antes de cerrar', () => {
    const r = ranurasHoy(H, t(5, '20:50'));
    expect(r).toEqual(['21:15', '21:30', '21:45']);
  });
  it('antes de abrir empieza a la apertura', () => {
    expect(ranurasHoy(H, t(1, '10:00'))[0]).toBe('13:00');
  });
  it('martes no hay horas', () => { expect(ranurasHoy(H, t(2, '15:00'))).toEqual([]); });
  it('casi al cierre no hay horas', () => { expect(ranurasHoy(H, t(1, '20:40'))).toEqual([]); });
});
