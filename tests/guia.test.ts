import { describe, expect, it } from 'vitest';
import {
  apagarEnSesion, BUSQUEDA, CADUCIDAD_MS, colocar, colocarBienvenida, depurar, ESPERA_PEDIDO_MS, esperaPedido, DURACION_MS, encolar, ESPERA_MAX_MS, estadoVacio, guiaActiva, leerEstado,
  marcar, marcarBienvenida, PISTAS, prepararBienvenida, reiniciar, RESPIRO_MS, serializar, siguiente, textoPista, tocaBienvenida, tocaBusqueda, visto,
  type Cola, type Estado,
} from '../src/lib/guia';

const T0 = Date.UTC(2026, 10, 18, 20, 0);
const DIA = 24 * 60 * 60 * 1000;

describe('estado guardado', () => {
  it('vacío, JSON roto u otra versión → estado nuevo', () => {
    for (const raw of [null, undefined, '', '{', 'null', '42', '[]', '{"v":2,"vistas":{"isla":1}}', '{"vistas":{"isla":1}}']) {
      expect(leerEstado(raw, T0)).toEqual(estadoVacio());
    }
  });
  it('ida y vuelta: marcar, serializar y leer conserva lo visto', () => {
    let e = marcar(estadoVacio(), 'isla', T0);
    e = marcar(e, 'pasos', T0 + 1000);
    const leido = leerEstado(serializar(e), T0 + 2000);
    expect(visto(leido, 'isla')).toBe(true);
    expect(visto(leido, 'pasos')).toBe(true);
    expect(visto(leido, 'busqueda')).toBe(false);
  });
  it('marcar dos veces conserva la primera fecha y no muta el original', () => {
    const a = estadoVacio();
    const b = marcar(a, 'agregar', T0);
    const c = marcar(b, 'agregar', T0 + 5000);
    expect(a.vistas).toEqual({});
    expect(c).toBe(b);
    expect(c.vistas.agregar).toBe(T0);
  });
  it('descarta ids desconocidos, fechas inválidas y mesas fuera de rango', () => {
    const raw = JSON.stringify({ v: 1, vistas: { isla: T0, inventada: T0, pedido: 'ayer', agregar: Number.NaN, busqueda: null }, mesa: 140 });
    const e = leerEstado(raw, T0);
    expect(e.vistas).toEqual({ isla: T0 });
    expect(e.mesa).toBeUndefined();
    expect(leerEstado(JSON.stringify({ v: 1, vistas: {}, mesa: 7 }), T0).mesa).toBe(7);
  });
  it('caduca a los 180 días y no acepta fechas del futuro', () => {
    const raw = JSON.stringify({ v: 1, vistas: { isla: T0 - CADUCIDAD_MS - 1, pedido: T0 - 10 * DIA, agregar: T0 + DIA } });
    const e = leerEstado(raw, T0);
    expect(visto(e, 'isla')).toBe(false);
    expect(visto(e, 'pedido')).toBe(true);
    expect(visto(e, 'agregar')).toBe(false);
  });
  it('reiniciar deja como nuevas las pistas, pero conserva la bienvenida de la mesa', () => {
    let e: Estado = marcar(marcar(marcar(estadoVacio(), 'isla', T0), 'camaron', T0), 'pasos', T0);
    e = marcarBienvenida(e, 7, T0);
    const r = reiniciar(e);
    for (const id of ['isla', 'camaron', 'pasos'] as const) expect(visto(r, id)).toBe(false);
    expect(visto(r, 'bienvenida')).toBe(true);
    expect(r.mesa).toBe(7);
    expect(tocaBienvenida(r, 7)).toBe(false);
    expect(reiniciar()).toEqual(estadoVacio());
    expect(e.vistas.isla).toBe(T0);
  });
});

describe('cuándo corre la guía', () => {
  it('apagada en modo presentación y con ?guia=0', () => {
    expect(guiaActiva('')).toBe(true);
    expect(guiaActiva('?src=qr-mesa-7')).toBe(true);
    expect(guiaActiva('?demo=1')).toBe(false);
    expect(guiaActiva('?guia=0')).toBe(false);
    expect(guiaActiva('?x=1&demo=1')).toBe(false);
    expect(guiaActiva('?demo=0')).toBe(true);
  });
  it('?guia=0 se recuerda en la sesión; ?guia=1 la vuelve a encender', () => {
    expect(guiaActiva('', true)).toBe(false);
    expect(apagarEnSesion('?guia=0')).toBe(true);
    expect(apagarEnSesion('?guia=1')).toBe(false);
    expect(apagarEnSesion('?src=qr-mesa-3')).toBeNull();
  });
  it('bienvenida: solo con mesa de QR y una vez por mesa', () => {
    const e0 = estadoVacio();
    expect(tocaBienvenida(e0, null)).toBe(false);
    expect(tocaBienvenida(e0, 7)).toBe(true);
    const e1 = marcarBienvenida(e0, 7, T0);
    expect(tocaBienvenida(e1, 7)).toBe(false);
    expect(tocaBienvenida(e1, 12)).toBe(true);
    expect(leerEstado(serializar(e1), T0).mesa).toBe(7);
    // Otra mesa: se olvida la bienvenida anterior para que pueda encolarse; la misma mesa no cambia nada.
    expect(visto(prepararBienvenida(e1, 12), 'bienvenida')).toBe(false);
    expect(visto(prepararBienvenida(e1, 12), 'isla')).toBe(false);
    expect(prepararBienvenida(e1, 7)).toBe(e1);
    expect(prepararBienvenida(e1, null)).toBe(e1);
    expect(encolar([], 'bienvenida', T0, prepararBienvenida(e1, 12))).toHaveLength(1);
  });
  it('buscar: después de la isla y cuando ya se explora (2 secciones o 20 s)', () => {
    expect(tocaBusqueda({ islaVista: false, cambios: 9, msConIsla: 99_000 })).toBe(false);
    expect(tocaBusqueda({ islaVista: true, cambios: 0, msConIsla: 0 })).toBe(false);
    expect(tocaBusqueda({ islaVista: true, cambios: BUSQUEDA.cambios - 1, msConIsla: BUSQUEDA.ms - 1 })).toBe(false);
    expect(tocaBusqueda({ islaVista: true, cambios: BUSQUEDA.cambios, msConIsla: 0 })).toBe(true);
    expect(tocaBusqueda({ islaVista: true, cambios: 0, msConIsla: BUSQUEDA.ms })).toBe(true);
  });
  it('buscar espera a la pista del pedido tras el primer platillo (sale encima del aviso «Agregado» si no)', () => {
    expect(tocaBusqueda({ islaVista: true, cambios: 5, msConIsla: 0, esperaPedido: true })).toBe(false);
    expect(esperaPedido({ primerAgregado: null, pedidoVisto: false, ahora: T0 })).toBe(false);
    expect(esperaPedido({ primerAgregado: T0, pedidoVisto: false, ahora: T0 + 1000 })).toBe(true);
    expect(esperaPedido({ primerAgregado: T0, pedidoVisto: true, ahora: T0 + 1000 })).toBe(false);
    // Si la del pedido nunca llega a salir, buscar no se queda bloqueada para siempre.
    expect(esperaPedido({ primerAgregado: T0, pedidoVisto: false, ahora: T0 + ESPERA_PEDIDO_MS })).toBe(false);
  });
});

describe('cola: nunca dos a la vez', () => {
  const e0 = estadoVacio();
  const libre = { e: e0, actual: null, ocupada: false, ultimaTermino: -Infinity };

  it('ordena por prioridad (isla antes que agregar; pedido antes que buscar)', () => {
    let c: Cola = [];
    c = encolar(c, 'busqueda', T0, e0);
    c = encolar(c, 'agregar', T0 + 1, e0);
    c = encolar(c, 'pedido', T0 + 2, e0);
    c = encolar(c, 'isla', T0 + 3, e0);
    expect(c.map((x) => x.id)).toEqual(['isla', 'pedido', 'agregar', 'busqueda']);
  });
  it('no duplica, ni encola lo visto ni la que está a la vista', () => {
    let c: Cola = encolar([], 'isla', T0, e0);
    c = encolar(c, 'isla', T0 + 5, e0);
    expect(c).toHaveLength(1);
    expect(encolar([], 'isla', T0, marcar(e0, 'isla', T0))).toHaveLength(0);
    expect(encolar([], 'isla', T0, e0, 'isla')).toHaveLength(0);
  });
  it('saca una a la vez y espera a que termine la que está a la vista', () => {
    let c: Cola = encolar(encolar([], 'agregar', T0, e0), 'isla', T0, e0);
    const a = siguiente(c, T0, libre);
    expect(a.id).toBe('isla');
    c = a.cola;
    expect(siguiente(c, T0 + 10, { ...libre, actual: 'isla' }).id).toBeNull();
    expect(siguiente(c, T0 + 10, { ...libre, actual: 'isla' }).cola).toHaveLength(1);
  });
  it('respeta el respiro entre pistas y no sale con la página ocupada', () => {
    const c = encolar([], 'agregar', T0, e0);
    expect(siguiente(c, T0 + 100, { ...libre, ultimaTermino: T0 }).id).toBeNull();
    expect(siguiente(c, T0 + RESPIRO_MS, { ...libre, ultimaTermino: T0 }).id).toBe('agregar');
    expect(siguiente(c, T0, { ...libre, ocupada: true }).id).toBeNull();
  });
  it('lo que espera de más caduca; lo visto mientras esperaba se descarta', () => {
    const c = encolar(encolar([], 'agregar', T0, e0), 'busqueda', T0, e0);
    expect(depurar(c, T0 + ESPERA_MAX_MS.agregar + 1, e0).map((x) => x.id)).toEqual(['busqueda']);
    expect(depurar(c, T0, marcar(e0, 'agregar', T0)).map((x) => x.id)).toEqual(['busqueda']);
    expect(siguiente(c, T0 + 60_000, libre).id).toBeNull();
  });
  it('cada pista tiene duración de 4 a 6 s y espera máxima', () => {
    for (const id of PISTAS) {
      expect(DURACION_MS[id]).toBeGreaterThanOrEqual(4000);
      expect(DURACION_MS[id]).toBeLessThanOrEqual(6000);
      expect(ESPERA_MAX_MS[id]).toBeGreaterThan(0);
    }
  });
});

describe('textos', () => {
  it('cortos, en los dos idiomas y distintos entre sí', () => {
    for (const id of PISTAS) {
      const es = textoPista(id, 'es', { mesa: 7 });
      const en = textoPista(id, 'en', { mesa: 7 });
      expect(es.titulo).not.toBe(en.titulo);
      expect(es.detalle).not.toBe(en.detalle);
      for (const t of [es, en]) expect(t.titulo.length + t.detalle.length).toBeLessThanOrEqual(90);
    }
  });
  it('la mesa aparece en la bienvenida y en la pista del pedido', () => {
    expect(textoPista('bienvenida', 'es', { mesa: 7 })).toMatchObject({ titulo: 'Mesa 7', detalle: 'Pide desde aquí y te lo llevamos' });
    expect(textoPista('bienvenida', 'en', { mesa: 7 }).titulo).toBe('Table 7');
    expect(textoPista('pedido', 'es', { mesa: 7 }).detalle).toContain('mesa 7');
    expect(textoPista('pedido', 'en', { mesa: 7 }).detalle).toContain('table 7');
    expect(textoPista('pedido', 'es').detalle).toBe('Revísalo y envíalo por WhatsApp');
  });
  it('isla: gesto de deslizar en táctil; flechas con ratón', () => {
    expect(textoPista('isla', 'es', { tactil: true }).detalle).toContain('Desliza');
    expect(textoPista('isla', 'es', { tactil: false }).detalle).toContain('flechas');
  });
  it('con ratón dice «Haz clic», no «Toca»', () => {
    for (const id of ['isla', 'agregar'] as const) {
      expect(textoPista(id, 'es', { tactil: false }).titulo).toMatch(/^Haz clic/);
      expect(textoPista(id, 'en', { tactil: false }).titulo).toMatch(/^Click/);
      expect(textoPista(id, 'es', { tactil: true }).titulo).toMatch(/^Toca/);
    }
  });
  it('el anuncio para lector de pantalla no lleva flechas dibujadas ni gestos', () => {
    for (const id of PISTAS) for (const idioma of ['es', 'en'] as const) for (const tactil of [true, false]) {
      const a = textoPista(id, idioma, { mesa: 7, tactil }).anuncio;
      expect(a).not.toMatch(/[⇆←→]/);
      expect(a).not.toMatch(/\b(Desliza|Swipe|Arrastra|Drag|Toca|Tap)\b/);
      expect(a.length).toBeGreaterThan(10);
    }
  });
});

describe('colocar la pista junto a lo que explica', () => {
  const vista = { w: 390, h: 664 };
  const tam = { w: 280, h: 90 };
  it('arriba de la isla, alineada a la píldora, con el hilo sobre su centro', () => {
    const ancla = { x: 12, y: 600, w: 250, h: 52 };
    const r = colocar({ ancla, tam, vista, lado: 'arriba', alinear: 'inicio' });
    expect(r.lado).toBe('arriba');
    expect(r.x).toBe(12);
    expect(r.y + tam.h).toBeLessThanOrEqual(ancla.y);
    expect(r.hilo).toBe(125);
  });
  it('nunca se sale de la pantalla y el hilo queda dentro de la tarjeta', () => {
    const ancla = { x: 340, y: 10, w: 44, h: 44 };
    const r = colocar({ ancla, tam, vista, lado: 'abajo' });
    expect(r.x + tam.w).toBeLessThanOrEqual(vista.w - 12);
    expect(r.x).toBeGreaterThanOrEqual(12);
    expect(r.hilo).toBeGreaterThanOrEqual(20);
    expect(r.hilo).toBeLessThanOrEqual(tam.w - 20);
    expect(r.y).toBeGreaterThanOrEqual(ancla.y + ancla.h);
  });
  it('si no cabe del lado pedido, pasa al otro sin tapar el ancla', () => {
    const arribaDelTodo = { x: 100, y: 30, w: 150, h: 150 };
    const r = colocar({ ancla: arribaDelTodo, tam, vista, lado: 'arriba' });
    expect(r.lado).toBe('abajo');
    expect(r.y).toBeGreaterThanOrEqual(arribaDelTodo.y + arribaDelTodo.h);
    const abajoDelTodo = { x: 100, y: 560, w: 150, h: 90 };
    expect(colocar({ ancla: abajoDelTodo, tam, vista, lado: 'abajo' }).lado).toBe('arriba');
  });
  it('en 320 px de ancho también cabe', () => {
    const r = colocar({ ancla: { x: 8, y: 500, w: 200, h: 52 }, tam: { w: 296, h: 100 }, vista: { w: 320, h: 568 }, lado: 'arriba', alinear: 'inicio' });
    expect(r.x).toBe(12);
    expect(r.x + 296).toBeLessThanOrEqual(320 - 12);
  });
});

describe('bienvenida de mesa en la portada', () => {
  const tam = { w: 344, h: 86 };
  it('en el teléfono, sobre la fila del estado y nunca encima del logo', () => {
    const logo = { x: 16, y: 90, w: 310, h: 120 };
    const chip = { x: 16, y: 275, w: 236, h: 40 };
    const r = colocarBienvenida({ tam, vista: { w: 390, h: 664 }, logo, chip, nav: 56 });
    expect(r.junto).toBe(false);
    expect(r.y).toBeGreaterThanOrEqual(logo.y + logo.h);
    expect(r.y).toBeLessThanOrEqual(chip.y);
    expect(r.y + tam.h).toBeGreaterThanOrEqual(chip.y + chip.h);
    expect(r.x).toBe(16);
  });
  it('en pantallas anchas, junto al estado («Abierto ahora»)', () => {
    const r = colocarBienvenida({ tam: { w: 344, h: 92 }, vista: { w: 1440, h: 900 }, logo: { x: 152, y: 120, w: 520, h: 200 }, chip: { x: 152, y: 383, w: 218, h: 42 }, nav: 64 });
    expect(r.junto).toBe(true);
    expect(r.x).toBeGreaterThanOrEqual(152 + 218);
    expect(r.y).toBeGreaterThanOrEqual(320);
  });
  it('si la portada ya no está a la vista, bajo la barra superior', () => {
    const r = colocarBienvenida({ tam, vista: { w: 390, h: 664 }, logo: { x: 16, y: -600, w: 310, h: 120 }, chip: { x: 16, y: -400, w: 236, h: 40 }, nav: 56 });
    expect(r.y).toBe(66);
    expect(colocarBienvenida({ tam, vista: { w: 390, h: 664 }, logo: null, chip: null, nav: 56 }).y).toBe(66);
  });
});
