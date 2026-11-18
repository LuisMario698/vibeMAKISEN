import { describe, expect, it } from 'vitest';
import { crearMemoria, CLAVES_AISLADAS, esClaveAislada, esDemo } from '../src/lib/demo-almacen';
import {
  CIERRE, crearReloj, duracionAccion, duracionMovimiento, duracionPaso, duracionTotal, escalaDe, esEnlaceExterno, GUION, LECTURA, MS_TOQUE,
  numeroPaso, progreso, suave, trayectoria, urlDemo, urlSinDemo, type Paso,
} from '../src/lib/presentacion';

describe('guion', () => {
  it('recorre el flujo completo en orden', () => {
    expect(GUION.map((p) => p.id)).toEqual(['portada', 'secciones', 'busqueda', 'agregar', 'bebida', 'comanda', 'entrega', 'pago', 'enviar']);
  });
  it('cada paso tiene texto en español e inglés y al menos una acción', () => {
    for (const p of GUION) {
      for (const t of [p.titulo, p.linea]) {
        expect(t.es.trim().length).toBeGreaterThan(3);
        expect(t.en.trim().length).toBeGreaterThan(3);
        expect(t.es).not.toBe(t.en);
      }
      expect(p.acciones.length).toBeGreaterThan(0);
    }
    for (const t of [CIERRE.titulo, CIERRE.nota, CIERRE.otraVez, CIERRE.explorar, ...CIERRE.beneficios]) expect(t.en && t.es).toBeTruthy();
    expect(CIERRE.beneficios).toHaveLength(3);
  });
  it('los títulos caben en una línea de la banda (versalitas en teléfono)', () => {
    for (const p of GUION) for (const t of [p.titulo.es, p.titulo.en]) expect(t.length).toBeLessThanOrEqual(24);
  });
  it('todos los selectores son CSS válido y apuntan a la interfaz real (sin innerHTML ni texto del cliente)', () => {
    for (const p of GUION) {
      for (const a of p.acciones) {
        const sels = 'sel' in a ? [a.sel, ...('alternativas' in a ? a.alternativas ?? [] : []), ...('si' in a && a.si ? [a.si] : [])] : [];
        for (const s of sels) {
          expect(s).toMatch(/^[#.[a-z]/);
          expect(s).not.toMatch(/<|>(?![^[]*\])/);
        }
      }
    }
  });
  it('nunca toca WhatsApp directo, el teléfono ni el mapa: el envío se intercepta', () => {
    const sels = GUION.flatMap((p) => p.acciones.flatMap((a) => ('sel' in a ? [a.sel, ...('alternativas' in a ? a.alternativas ?? [] : [])] : [])));
    for (const s of sels) expect(s).not.toMatch(/isla-wa|tel:|wa\.me|pd-abrir-mapa|pd-reenviar|pd-preguntar/);
    expect(sels).toContain('#lista-enviar');
  });
  it('en mesa con una mesa libre del plano y pago en efectivo', () => {
    const entrega = GUION.find((p) => p.id === 'entrega')!;
    expect(entrega.acciones.some((a) => 'sel' in a && a.sel.includes('value="mesa"'))).toBe(true);
    expect(entrega.acciones.some((a) => 'sel' in a && a.sel.includes('.pd-mesa') && a.sel.includes(':not([data-ocupada="si"])'))).toBe(true);
    const pago = GUION.find((p) => p.id === 'pago')!;
    expect(pago.acciones.some((a) => 'sel' in a && a.sel.includes('value="efectivo"'))).toBe(true);
  });
});

describe('tiempos', () => {
  it('el recorrido dura entre 45 y 75 s', () => {
    const t = duracionTotal();
    expect(t).toBeGreaterThanOrEqual(45_000);
    expect(t).toBeLessThanOrEqual(75_000);
  });
  it('cada paso da tiempo de leer su subtítulo (≥ 3 s) y ninguno se alarga de más (≤ 12 s)', () => {
    for (const p of GUION) {
      expect(duracionPaso(p)).toBeGreaterThanOrEqual(3000);
      expect(duracionPaso(p)).toBeLessThanOrEqual(12_000);
    }
  });
  it('duración de cada tipo de acción', () => {
    expect(duracionAccion({ hacer: 'esperar', ms: 900 })).toBe(900);
    expect(duracionAccion({ hacer: 'tocar', sel: '#x', pausa: 500 })).toBe(MS_TOQUE + 500);
    expect(duracionAccion({ hacer: 'escribir', sel: '#b', texto: { es: 'camarón', en: 'shrimp' }, msLetra: 100, pausa: 0 })).toBe(700);
    expect(duracionAccion({ hacer: 'esperarA', sel: '#h', ms: 3000 })).toBe(0);
  });
  it('las acciones condicionales no inflan el avance', () => {
    const p: Paso = { id: 'x', titulo: { es: 'a', en: 'b' }, linea: { es: 'a', en: 'b' }, limpia: 'nada', acciones: [{ hacer: 'tocar', sel: '#a', si: '#b', pausa: 5000 }, { hacer: 'esperar', ms: 1000 }] };
    expect(duracionPaso(p)).toBe(LECTURA + 1000);
  });
  it('?rapido=1 acelera (solo pruebas); sin él, tiempo normal', () => {
    expect(escalaDe('?demo=1')).toBe(1);
    expect(escalaDe('?demo=1&rapido=1')).toBeLessThan(0.2);
  });
});

describe('progreso', () => {
  it('empieza en 0, crece con el tiempo y los pasos, y termina en 1', () => {
    expect(progreso(GUION, 0, 0)).toBe(0);
    const a = progreso(GUION, 2, 0);
    const b = progreso(GUION, 2, 2000);
    const c = progreso(GUION, 3, 0);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(progreso(GUION, GUION.length, 0)).toBe(1);
  });
  it('no se pasa del paso actual aunque el paso tarde más de lo previsto', () => {
    const fin = progreso(GUION, 4, 10_000_000);
    expect(fin).toBeLessThan(progreso(GUION, 5, 0));
  });
  it('respeta la escala de tiempo', () => {
    expect(progreso(GUION, 1, 500, 0.1)).toBeCloseTo(progreso(GUION, 1, 5000, 1), 6);
  });
  it('numera los pasos', () => {
    expect(numeroPaso(0)).toBe(`1/${GUION.length}`);
    expect(numeroPaso(8, 9)).toBe('9/9');
  });
});

describe('reloj con pausa', () => {
  it('no cuenta el tiempo en pausa y se reanuda donde iba', () => {
    let t = 1000;
    const r = crearReloj(() => t);
    t = 1500;
    expect(r.transcurrido()).toBe(500);
    expect(r.pausar()).toBe(true);
    expect(r.pausar()).toBe(false);
    t = 9000;
    expect(r.transcurrido()).toBe(500);
    expect(r.pausado).toBe(true);
    expect(r.reanudar()).toBe(true);
    t = 9300;
    expect(r.transcurrido()).toBe(800);
    expect(r.reanudar()).toBe(false);
  });
});

describe('cursor', () => {
  it('la curva sale del origen y llega exacto al destino, sin salirse demasiado', () => {
    const a = { x: 10, y: 600 }, b = { x: 300, y: 120 };
    const pts = trayectoria(a, b, 18, 1);
    expect(pts).toHaveLength(19);
    expect(pts[0]).toEqual(a);
    expect(pts.at(-1)!.x).toBeCloseTo(b.x, 6);
    expect(pts.at(-1)!.y).toBeCloseTo(b.y, 6);
    for (const p of pts) {
      expect(p.x).toBeGreaterThan(-100);
      expect(p.x).toBeLessThan(400);
    }
  });
  it('es una curva (no una recta) y el lado cambia su sentido', () => {
    const a = { x: 0, y: 0 }, b = { x: 400, y: 0 };
    const izq = trayectoria(a, b, 10, 1)[5]!;
    const der = trayectoria(a, b, 10, -1)[5]!;
    expect(Math.abs(izq.y)).toBeGreaterThan(10);
    expect(Math.sign(izq.y)).toBe(-Math.sign(der.y));
  });
  it('mismo punto: se queda quieto (sin NaN)', () => {
    for (const p of trayectoria({ x: 5, y: 5 }, { x: 5, y: 5 }, 4)) expect(p).toEqual({ x: 5, y: 5 });
  });
  it('acelera y frena (lento en los extremos)', () => {
    expect(suave(0)).toBe(0);
    expect(suave(1)).toBe(1);
    expect(suave(0.5)).toBeCloseTo(0.5, 6);
    expect(suave(0.1)).toBeLessThan(0.1);
    expect(suave(0.9)).toBeGreaterThan(0.9);
  });
  it('más lejos tarda más, con topes', () => {
    const o = { x: 0, y: 0 };
    expect(duracionMovimiento(o, { x: 1, y: 0 })).toBe(420);
    expect(duracionMovimiento(o, { x: 300, y: 0 })).toBeGreaterThan(duracionMovimiento(o, { x: 100, y: 0 }));
    expect(duracionMovimiento(o, { x: 5000, y: 5000 })).toBe(950);
  });
});

describe('enlaces externos y URL', () => {
  it('bloquea WhatsApp, llamadas y mapas; deja pasar lo interno', () => {
    for (const h of ['https://wa.me/526381560660?text=hola', 'tel:6381560660', 'https://maps.google.com/?q=1,2', 'https://www.google.com/maps/dir/?api=1', 'https://maps.app.goo.gl/abc', 'whatsapp://send', 'geo:31,-113'])
      expect(esEnlaceExterno(h)).toBe(true);
    for (const h of ['#menu', '/en/', 'https://makizen.example/', '/brand/logo.svg']) expect(esEnlaceExterno(h)).toBe(false);
  });
  it('salir quita ?demo, ?rapido y el #sección; conserva lo demás', () => {
    expect(urlSinDemo('https://x.mx/?demo=1#cervezas')).toBe('/');
    expect(urlSinDemo('https://x.mx/en/?demo=1&rapido=1')).toBe('/en/');
    expect(urlSinDemo('https://x.mx/?utm_source=qr&demo=1')).toBe('/?utm_source=qr');
  });
  it('ver otra vez vuelve a la portada con ?demo (y conserva ?rapido)', () => {
    expect(urlDemo('https://x.mx/en/?demo=1#guisos')).toBe('/en/?demo=1');
    expect(urlDemo('https://x.mx/?demo=1&rapido=1#x')).toBe('/?demo=1&rapido=1');
  });
});

describe('almacén aislado de la demostración', () => {
  it('solo ?demo=1 activa el modo', () => {
    expect(esDemo('?demo=1')).toBe(true);
    expect(esDemo('?src=qr-mesa-4&demo=1')).toBe(true);
    for (const s of ['', '?demo=0', '?demo', '?demo=true', '?xdemo=1']) expect(esDemo(s)).toBe(false);
  });
  it('aísla el carrito, el seguimiento, la mesa y el idioma; nada más', () => {
    for (const k of ['makizen-lista', 'makizen-pedido', 'makizen-mesa', 'makizen-mesa-qr', 'makizen-modo-elegido', 'makizen-idioma']) expect(esClaveAislada(k)).toBe(true);
    for (const k of ['makizen-intro', 'makizen-portada-quieta', 'otra', '', null, 42]) expect(esClaveAislada(k)).toBe(false);
    expect(CLAVES_AISLADAS).toContain('makizen-lista');
  });
  it('la memoria se comporta como Storage', () => {
    const m = crearMemoria();
    expect(m.getItem('a')).toBeNull();
    m.setItem('a', '1');
    m.setItem('b', 2);
    expect(m.getItem('a')).toBe('1');
    expect(m.getItem('b')).toBe('2');
    m.removeItem('a');
    expect(m.getItem('a')).toBeNull();
    expect(m.size).toBe(1);
  });
});
