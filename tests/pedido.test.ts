import { describe, expect, it } from 'vitest';
import { leerMesa, sinMesa } from '../src/lib/mesa';
import {
  agregar, armarMensaje, cambiar, cambiarNota, enlaceWhatsApp, LIMITES, listaVacia, PASO_DE, piezas, restaurar, sanear, subtotal, validar,
  type Catalogo, type Entrega, type Lista,
} from '../src/lib/pedido';

const AHORA = Date.UTC(2026, 10, 15, 20, 0);
const cat: Catalogo = new Map([
  ['makizen-roll', { nombre: { es: 'Makizen Roll Empanizado', en: 'Makizen Breaded Roll' }, precio: 240, agotado: false }],
  ['sopa-vietnamita', {
    nombre: { es: 'Sopa Vietnamita de Pollo o Camarón', en: 'Vietnamese Soup' }, precio: 160, agotado: false,
    opciones: { titulo: { es: 'Proteína', en: 'Protein' }, valores: [{ id: 'pollo', nombre: { es: 'Pollo', en: 'Chicken' } }, { id: 'camaron', nombre: { es: 'Camarón', en: 'Shrimp' } }] },
  }],
  ['hanagoi', { nombre: { es: 'Hanagoi Sparkling', en: 'Hanagoi Sparkling' }, precio: 600, agotado: true }],
  ['mojito-mango', { nombre: { es: 'Mojito de Mango', en: 'Mango Mojito' }, precio: 130, agotado: false }],
]);
const base = () => listaVacia(AHORA);
const entrega = (o: Partial<Entrega> = {}): Entrega => ({ modo: 'mesa', nombre: '', hora: 'pronto', direccion: '', referencias: '', mesa: 4, ...o });

function con(...items: { id: string; op?: string; n: number; nota?: string }[]): Lista {
  let l = base();
  for (const it of items) l = agregar(l, it, cat, AHORA).lista;
  return l;
}

describe('leerMesa', () => {
  it('lee qr-mesa-N de 1 a 99', () => {
    expect(leerMesa('?src=qr-mesa-12')).toBe(12);
    expect(leerMesa('?a=1&src=qr-mesa-7')).toBe(7);
  });
  it('rechaza valores inválidos', () => {
    for (const s of ['?src=qr-mesa-0', '?src=qr-mesa--3', '?src=qr-mesa-12abc', '?src=qr-mesa-100', '?src=instagram', '']) expect(leerMesa(s)).toBeNull();
  });
  it('sinMesa quita solo src', () => {
    expect(sinMesa('https://x.dev/en/?src=qr-mesa-7#rollos')).toBe('/en/#rollos');
    expect(sinMesa('https://x.dev/?src=qr-mesa-7&utm=a')).toBe('/?utm=a');
  });
});

describe('agregar y cambiar', () => {
  it('suma cantidades de la misma línea', () => {
    const l = con({ id: 'makizen-roll', n: 2 }, { id: 'makizen-roll', n: 1 });
    expect(l.lineas).toHaveLength(1);
    expect(l.lineas[0]!.n).toBe(3);
  });
  it('misma comida con nota distinta va en otra línea', () => {
    expect(con({ id: 'makizen-roll', n: 1 }, { id: 'makizen-roll', n: 1, nota: 'sin queso' }).lineas).toHaveLength(2);
  });
  it('exige opción válida cuando el platillo la tiene', () => {
    expect(agregar(base(), { id: 'sopa-vietnamita', n: 1 }, cat, AHORA).error).toBe('opcion');
    expect(agregar(base(), { id: 'sopa-vietnamita', n: 1, op: 'res' }, cat, AHORA).error).toBe('opcion');
    expect(agregar(base(), { id: 'sopa-vietnamita', n: 1, op: 'camaron' }, cat, AHORA).error).toBeUndefined();
  });
  it('no agrega agotados ni inexistentes', () => {
    expect(agregar(base(), { id: 'hanagoi', n: 1 }, cat, AHORA).error).toBe('agotado');
    expect(agregar(base(), { id: 'nada', n: 1 }, cat, AHORA).error).toBe('inexistente');
  });
  it('avisa cuántas piezas se sumaron y da error al llegar al tope', () => {
    const l = con({ id: 'makizen-roll', n: 18 });
    const r = agregar(l, { id: 'makizen-roll', n: 5 }, cat, AHORA);
    expect(r.agregadas).toBe(2);
    expect(r.lista.lineas[0]!.n).toBe(20);
    expect(agregar(r.lista, { id: 'makizen-roll', n: 1 }, cat, AHORA)).toMatchObject({ error: 'tope', agregadas: 0 });
  });
  it('respeta el tope de cantidad y de líneas', () => {
    expect(con({ id: 'makizen-roll', n: 50 }).lineas[0]!.n).toBe(LIMITES.cantidad);
    let l = base();
    for (let i = 0; i < LIMITES.lineas; i++) l = agregar(l, { id: 'makizen-roll', n: 1, nota: `n${i}` }, cat, AHORA).lista;
    expect(agregar(l, { id: 'mojito-mango', n: 1 }, cat, AHORA).error).toBe('llena');
  });
  it('recorta la nota y limpia saltos de línea', () => {
    const l = con({ id: 'makizen-roll', n: 1, nota: `sin\ncebolla ${'x'.repeat(200)}` });
    expect(l.lineas[0]!.nota!.length).toBe(LIMITES.nota);
    expect(l.lineas[0]!.nota).not.toContain('\n');
  });
  it('cambiar a 0 quita la línea', () => {
    const l = cambiar(con({ id: 'makizen-roll', n: 2 }), 0, 0, AHORA);
    expect(l.lineas).toHaveLength(0);
  });
  it('no muta la lista original', () => {
    const l = base();
    agregar(l, { id: 'makizen-roll', n: 1 }, cat, AHORA);
    expect(l.lineas).toHaveLength(0);
  });
});

describe('sanear', () => {
  const guardada = (o: Partial<Lista>) => ({ ...base(), ...o });
  it('vacía lo corrupto, de otra versión o viejo', () => {
    expect(sanear('basura', cat, AHORA).lista.lineas).toEqual([]);
    expect(sanear({ ...guardada({}), v: 2 }, cat, AHORA).lista.lineas).toEqual([]);
    const vieja = guardada({ t: AHORA - 13 * 3600_000, lineas: [{ id: 'makizen-roll', n: 1, p: 240 }] });
    expect(sanear(vieja, cat, AHORA).lista.lineas).toEqual([]);
  });
  it('quita platillos que ya no existen y opciones inválidas', () => {
    const r = sanear(guardada({ lineas: [{ id: 'nada', n: 1, p: 10 }, { id: 'sopa-vietnamita', op: 'res', n: 1, p: 160 }, { id: 'makizen-roll', n: 1, p: 240 }] }), cat, AHORA);
    expect(r.lista.lineas.map((l) => l.id)).toEqual(['makizen-roll']);
    expect(r.avisos.filter((a) => a.tipo === 'quitado')).toHaveLength(2);
  });
  it('marca agotados y los saca del total', () => {
    const r = sanear(guardada({ lineas: [{ id: 'hanagoi', n: 1, p: 600 }, { id: 'makizen-roll', n: 1, p: 240 }] }), cat, AHORA);
    expect(r.avisos).toContainEqual({ tipo: 'agotado', id: 'hanagoi' });
    expect(r.lista.lineas).toHaveLength(2);
    expect(subtotal(r.lista, cat)).toBe(240);
    expect(piezas(r.lista, cat)).toBe(1);
  });
  it('actualiza precios que cambiaron', () => {
    const r = sanear(guardada({ lineas: [{ id: 'makizen-roll', n: 2, p: 200 }] }), cat, AHORA);
    expect(r.avisos).toContainEqual({ tipo: 'precio', id: 'makizen-roll', antes: 200, despues: 240 });
    expect(r.lista.lineas[0]!.p).toBe(240);
  });
  it('recorta cantidades y datos de entrega', () => {
    const r = sanear(guardada({ modo: 'x' as never, nombre: 'a'.repeat(99), lineas: [{ id: 'makizen-roll', n: 999, p: 240 }] }), cat, AHORA);
    expect(r.lista.lineas[0]!.n).toBe(LIMITES.cantidad);
    expect(r.lista.nombre.length).toBe(LIMITES.nombre);
    expect(r.lista.modo).toBe('llevar');
  });
});

describe('validar', () => {
  const l = con({ id: 'makizen-roll', n: 1 });
  it('lista vacía o solo agotados', () => {
    expect(validar(base(), cat, entrega()).lista).toBeDefined();
  });
  it('mesa 1–99', () => {
    expect(validar(l, cat, entrega({ mesa: null })).mesa).toBeDefined();
    expect(validar(l, cat, entrega({ mesa: 100 })).mesa).toBeDefined();
    expect(validar(l, cat, entrega({ mesa: 7 }))).toEqual({});
  });
  it('una hora de recoger que ya pasó no es válida', () => {
    const e = entrega({ modo: 'llevar', nombre: 'Ana', hora: '21:45' });
    expect(validar(l, cat, e, ['22:00', '22:15']).hora).toBe('pasada');
    expect(validar(l, cat, e, ['21:45'])).toEqual({});
    expect(validar(l, cat, { ...e, hora: 'pronto' }, [])).toEqual({});
  });
  it('para llevar pide nombre y hora', () => {
    expect(validar(l, cat, entrega({ modo: 'llevar', nombre: 'A', hora: '' }))).toEqual({ nombre: 'requerido', hora: 'requerida' });
    expect(validar(l, cat, entrega({ modo: 'llevar', nombre: 'Ana', hora: '19:30' }))).toEqual({});
  });
  it('a domicilio pide nombre y dirección', () => {
    expect(validar(l, cat, entrega({ modo: 'domicilio', nombre: 'Ana', direccion: 'Calle' })).direccion).toBeDefined();
    expect(validar(l, cat, entrega({ modo: 'domicilio', nombre: 'Ana', direccion: 'Calle 13 #45, Centro' }))).toEqual({});
  });
});

describe('mensaje y enlace', () => {
  const l = con({ id: 'makizen-roll', n: 2 }, { id: 'sopa-vietnamita', op: 'camaron', n: 1, nota: 'sin cebolla' }, { id: 'hanagoi', n: 1 });
  it('mensaje en español, en mesa', () => {
    const m = armarMensaje(l, cat, entrega(), 'es');
    expect(m).toBe([
      '*Pedido MAKIZEN* (menú digital)',
      'En mesa: 4',
      '',
      '2 x Makizen Roll Empanizado  $480',
      '1 x Sopa Vietnamita de Pollo o Camarón (Camarón)  $160',
      '   Nota: sin cebolla',
      '',
      '*Subtotal: $640* MXN (IVA incluido)',
      'Precio final lo confirma el restaurante.',
    ].join('\n'));
  });
  it('mensaje en inglés con nombres de platillo en español', () => {
    const m = armarMensaje(l, cat, entrega({ modo: 'llevar', nombre: 'Ann', hora: '19:30' }), 'en');
    expect(m).toContain('Pickup: Ann - 7:30 pm');
    expect(m).toContain('2 x Makizen Roll Empanizado  $480');
    expect(m).toContain('(Camarón)');
    expect(m).toContain('Final price confirmed by the restaurant.');
  });
  it('a domicilio agrega dirección, referencias y aviso de envío', () => {
    const m = armarMensaje(l, cat, entrega({ modo: 'domicilio', nombre: 'Ana', direccion: 'Calle 13 #45', referencias: 'Portón negro' }), 'es');
    expect(m).toContain('A domicilio: Ana\nDirección: Calle 13 #45\nReferencias: Portón negro');
    expect(m).toContain('Envío: lo confirma el restaurante.');
  });
  it('para llevar lo antes posible', () => {
    expect(armarMensaje(l, cat, entrega({ modo: 'llevar', nombre: 'Ana', hora: 'pronto' }), 'es')).toContain('Para llevar: Ana - lo antes posible');
  });
  it('el enlace decodificado conserva caracteres especiales', () => {
    const r = enlaceWhatsApp('526381560660', con({ id: 'makizen-roll', n: 1, nota: 'ñ & # + % sin "chile"' }), cat, entrega(), 'es');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const u = new URL(r.url);
    expect(u.origin + u.pathname).toBe('https://wa.me/526381560660');
    expect(u.searchParams.get('text')).toContain('Nota: ñ & # + % sin "chile"');
  });
  it('compacta un pedido largo y rechaza uno que no cabe', () => {
    let largo = base();
    for (let i = 0; i < 25; i++) largo = agregar(largo, { id: 'makizen-roll', n: 2, nota: `nota larga número ${i} ${'x'.repeat(40)}` }, cat, AHORA).lista;
    const r = enlaceWhatsApp('526381560660', largo, cat, entrega(), 'es');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.compacto).toBe(true); expect(r.url.length).toBeLessThanOrEqual(4000); }
    let enorme = base();
    for (let i = 0; i < 30; i++) enorme = agregar(enorme, { id: 'makizen-roll', n: 2, nota: `${'ñ'.repeat(70)}${i}` }, cat, AHORA).lista;
    expect(enlaceWhatsApp('526381560660', enorme, cat, entrega(), 'es')).toEqual({ ok: false, motivo: 'larga' });
  });
  it('no parte emojis al recortar notas (pedido largo compacto)', () => {
    let l = base();
    const nota = `${'a'.repeat(39)}😀${'b'.repeat(39)}`;
    for (let i = 0; i < 12; i++) l = agregar(l, { id: 'makizen-roll', n: 1, nota: `${i}${nota}` }, cat, AHORA).lista;
    const r = enlaceWhatsApp('526381560660', l, cat, entrega(), 'es');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.compacto).toBe(true);
    // Nota de 80 unidades con el emoji justo en el límite.
    const borde = agregar(base(), { id: 'makizen-roll', n: 1, nota: `${'x'.repeat(79)}😀` }, cat, AHORA).lista;
    expect(() => encodeURIComponent(borde.lineas[0]!.nota!)).not.toThrow();
  });
  it('lista sin disponibles no genera enlace', () => {
    expect(enlaceWhatsApp('526381560660', con({ id: 'mojito-mango', n: 1 }), new Map([...cat, ['mojito-mango', { ...cat.get('mojito-mango')!, agotado: true }]]), entrega(), 'es')).toEqual({ ok: false, motivo: 'vacia' });
  });
});

describe('nota, deshacer y datos nuevos del pedido', () => {
  it('cambiar la nota de una línea', () => {
    const l = con({ id: 'makizen-roll', n: 2 });
    const r = cambiarNota(l, 0, '  sin  ajonjolí ', AHORA);
    expect(r.lista.lineas[0]).toMatchObject({ n: 2, nota: 'sin ajonjolí' });
    expect(cambiarNota(r.lista, 0, '', AHORA).lista.lineas[0]!.nota).toBeUndefined();
    expect(cambiarNota(l, 0, 'x'.repeat(200), AHORA).lista.lineas[0]!.nota).toHaveLength(LIMITES.nota);
  });
  it('si la nota la iguala a otra línea, se juntan (con tope)', () => {
    const l = con({ id: 'makizen-roll', n: 15 }, { id: 'mojito-mango', n: 1 }, { id: 'makizen-roll', n: 8, nota: 'sin queso' });
    const r = cambiarNota(l, 2, '', AHORA);
    expect(r.lista.lineas).toHaveLength(2);
    expect(r.lista.lineas[0]).toMatchObject({ id: 'makizen-roll', n: LIMITES.cantidad });
    expect(r.indice).toBe(0);
  });
  it('deshacer regresa la línea a su lugar', () => {
    const l = con({ id: 'makizen-roll', n: 1 }, { id: 'mojito-mango', n: 2 }, { id: 'sopa-vietnamita', op: 'pollo', n: 1 });
    const quitada = l.lineas[1]!;
    const sin = cambiar(l, 1, 0, AHORA);
    expect(restaurar(sin, 1, quitada, AHORA).lineas.map((x) => x.id)).toEqual(['makizen-roll', 'mojito-mango', 'sopa-vietnamita']);
    // Si mientras tanto volvió a agregar el mismo platillo, se suman.
    const otra = agregar(sin, { id: 'mojito-mango', n: 1 }, cat, AHORA).lista;
    expect(restaurar(otra, 1, quitada, AHORA).lineas.find((x) => x.id === 'mojito-mango')!.n).toBe(3);
  });
  it('sanea pago, monto, ubicación y folio guardados', () => {
    const bueno = { ...con({ id: 'makizen-roll', n: 1 }), pago: 'tarjeta', paga: 1000, ubic: { lat: 31.3157004, lng: -113.52861 }, folio: 'MZ-4F7K' };
    expect(sanear(bueno, cat, AHORA).lista).toMatchObject({ pago: 'tarjeta', paga: 1000, ubic: { lat: 31.3157, lng: -113.52861 }, folio: 'MZ-4F7K' });
    const malo = { ...bueno, pago: 'paypal', paga: -3, ubic: { lat: 'x' }, folio: 'MZ-0O1I' };
    expect(sanear(malo, cat, AHORA).lista).toMatchObject({ pago: '', paga: null, ubic: null, folio: '' });
    // Listas guardadas antes de estos campos siguen sirviendo.
    const vieja = { v: 1, t: AHORA, lineas: [{ id: 'makizen-roll', n: 1, p: 240 }], modo: 'mesa', nombre: '', hora: 'pronto', direccion: '', referencias: '' };
    expect(sanear(vieja, cat, AHORA).lista).toMatchObject({ lineas: [{ id: 'makizen-roll', n: 1 }], pago: '', paga: null, ubic: null, folio: '' });
  });
  it('valida forma de pago y que el efectivo cubra el total', () => {
    const l = con({ id: 'makizen-roll', n: 2 });
    expect(validar(l, cat, entrega({ pago: '' })).pago).toBe('requerido');
    expect(validar(l, cat, entrega({ pago: 'efectivo', paga: 400 })).paga).toBe('insuficiente');
    expect(validar(l, cat, entrega({ pago: 'efectivo', paga: 500 }))).toEqual({});
    expect(validar(l, cat, entrega({ pago: 'efectivo', paga: 'exacto' }))).toEqual({});
    expect(validar(l, cat, entrega({ pago: 'tarjeta', paga: 10 }))).toEqual({});
    expect(PASO_DE.pago).toBe(3);
    expect(PASO_DE.mesa).toBe(2);
  });
});

describe('mensaje con folio, pago, mesa y ubicación', () => {
  const l = con({ id: 'makizen-roll', n: 2 }, { id: 'sopa-vietnamita', op: 'camaron', n: 1, nota: 'sin cebolla' });
  it('español, en mesa, efectivo con cambio', () => {
    expect(armarMensaje(l, cat, entrega({ mesa: 7, folio: 'MZ-4F7K', pago: 'efectivo', paga: 1000 }), 'es')).toBe([
      '*Pedido MAKIZEN · MZ-4F7K* (menú digital)',
      'En mesa: 7',
      '',
      '2 x Makizen Roll Empanizado  $480',
      '1 x Sopa Vietnamita de Pollo o Camarón (Camarón)  $160',
      '   Nota: sin cebolla',
      '',
      '*Subtotal: $640* MXN (IVA incluido)',
      'Pago: efectivo, paga con $1,000 (cambio: $360)',
      'Precio final lo confirma el restaurante.',
    ].join('\n'));
  });
  it('a domicilio con ubicación del mapa y tarjeta', () => {
    const m = armarMensaje(l, cat, entrega({ modo: 'domicilio', nombre: 'Ana', direccion: 'Calle 13 #45', ubic: { lat: 31.3157, lng: -113.5286 }, folio: 'MZ-AB23', pago: 'tarjeta' }), 'es');
    expect(m).toContain('*Pedido MAKIZEN · MZ-AB23*');
    expect(m).toContain('Dirección: Calle 13 #45\nUbicación: https://maps.google.com/?q=31.315700,-113.528600');
    expect(m).toContain('Pago: tarjeta (terminal al recibir)\nEnvío: lo confirma el restaurante.');
  });
  it('inglés: rótulos traducidos, platillos en español', () => {
    const m = armarMensaje(l, cat, entrega({ modo: 'domicilio', nombre: 'Ann', direccion: '13th St #45', ubic: { lat: 31.3157, lng: -113.5286 }, folio: 'MZ-AB23', pago: 'efectivo', paga: 'exacto' }), 'en');
    expect(m).toContain('*MAKIZEN order · MZ-AB23* (digital menu)');
    expect(m).toContain('Location: https://maps.google.com/?q=31.315700,-113.528600');
    expect(m).toContain('2 x Makizen Roll Empanizado  $480');
    expect(m).toContain('Payment: cash (exact amount)');
    expect(armarMensaje(l, cat, entrega({ mesa: 12, pago: 'tarjeta' }), 'en')).toContain('Dine-in, table: 12');
  });
  it('sin folio válido ni ubicación en mesa/llevar, no se inventan líneas', () => {
    const m = armarMensaje(l, cat, entrega({ folio: 'malo', ubic: { lat: 31, lng: -113 } }), 'es');
    expect(m.startsWith('*Pedido MAKIZEN* (menú digital)')).toBe(true);
    expect(m).not.toContain('Ubicación');
    expect(m).not.toContain('Pago:');
  });
});
