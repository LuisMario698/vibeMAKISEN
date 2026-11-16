import { describe, expect, it } from 'vitest';
import { relojHoy, type Horario } from '../src/lib/horario';

const H: Horario[] = [
  { dia: 1, abre: '13:00', cierra: '21:00' },
  { dia: 5, abre: '13:00', cierra: '22:00' },
];

describe('relojHoy', () => {
  it('pone el arco como en un reloj real: de la 1 a las 10', () => {
    const r = relojHoy(H, { dia: 5, min: 15 * 60 });
    expect(r.arco).toEqual({ inicio: 30, largo: 270 });
    expect(r.aguja).toBe(90);
  });
  it('abierto: cuenta lo que falta para cerrar', () => {
    const r = relojHoy(H, { dia: 5, min: 18 * 60 + 40 });
    expect(r.abierto).toBe(true);
    expect(r.texto.es).toBe('Cierra en 3 h 20 min');
    expect(r.texto.en).toBe('Closes in 3 h 20 min');
  });
  it('antes de abrir: cuenta lo que falta para abrir', () => {
    const r = relojHoy(H, { dia: 1, min: 12 * 60 + 15 });
    expect(r.abierto).toBe(false);
    expect(r.texto.es).toBe('Abre en 45 min');
  });
  it('ya cerró: usa el texto del próximo día', () => {
    const r = relojHoy(H, { dia: 1, min: 21 * 60 + 30 });
    expect(r.abierto).toBe(false);
    expect(r.texto.es).toMatch(/^Cerrado · abre/);
  });
  it('día sin servicio: sin arco', () => {
    const r = relojHoy(H, { dia: 2, min: 14 * 60 });
    expect(r.arco).toBeNull();
    expect(r.texto.es).toMatch(/^Cerrado/);
  });
  it('horas exactas sin minutos sobrantes', () => {
    expect(relojHoy(H, { dia: 5, min: 20 * 60 }).texto.es).toBe('Cierra en 2 h');
  });
});
