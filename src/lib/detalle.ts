// Lógica pura del detalle del platillo y de la bolsa de «Mi pedido» (sin DOM): el trazo
// del ensō de pincel, las chispas doradas, el precio que rueda, la etiqueta accesible
// del botón del pedido y el arco de la miniatura que vuela a la bolsa.

/** Generador pseudoaleatorio determinista (mulberry32): mismas chispas para la misma semilla. */
export function azar(semilla: number) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export type OpcionesEnso = {
  /** Centro y radio medio del trazo (unidades del viewBox). */
  cx?: number; cy?: number; r?: number;
  /** Ángulo donde el pincel toca el papel (grados; 0 = derecha, sentido horario). */
  inicio?: number;
  /** Recorrido del trazo en grados (un ensō deja su abertura). */
  barrido?: number;
  /** Grosor máximo del pincel. */
  grosor?: number;
  muestras?: number;
};

/** Grosor relativo del pincel a lo largo del trazo (0..1): entra con presión, se carga y se seca al final. */
export function presion(s: number) {
  const entrada = Math.min(1, s / 0.07);
  const carga = 1 - 0.78 * Math.pow(s, 1.35);
  // El final se abre en «pincel seco»: se adelgaza más rápido en el último 15 %.
  const seco = s > 0.85 ? 1 - ((s - 0.85) / 0.15) * 0.55 : 1;
  return Math.max(0.06, (0.35 + 0.65 * entrada) * carga * seco);
}

/**
 * Contorno relleno de un ensō de pincel: un anillo abierto con grosor variable (no un
 * círculo uniforme). Devuelve el atributo `d` de un <path> cerrado.
 */
export function trazoEnso(o: OpcionesEnso = {}) {
  const { cx = 100, cy = 100, r = 84, inicio = 118, barrido = 326, grosor = 13, muestras = 96 } = o;
  const ext: string[] = [];
  const int: string[] = [];
  for (let i = 0; i <= muestras; i++) {
    const s = i / muestras;
    const a = ((inicio + barrido * s) * Math.PI) / 180;
    // El radio ondula apenas (mano humana) y el grosor sigue la presión del pincel.
    const radio = r + 1.6 * Math.sin(s * Math.PI * 2.3 + 0.6) + 0.8 * Math.sin(s * Math.PI * 7.1);
    const g = (grosor * presion(s)) / 2;
    const cos = Math.cos(a), sin = Math.sin(a);
    ext.push(`${r2(cx + (radio + g) * cos)} ${r2(cy + (radio + g) * sin)}`);
    int.push(`${r2(cx + (radio - g * 0.82) * cos)} ${r2(cy + (radio - g * 0.82) * sin)}`);
  }
  return `M${ext.join('L')}L${int.reverse().join('L')}Z`;
}

/** Arco guía (para la máscara que «pinta» el ensō en el mismo sentido que el pincel). */
export function arcoEnso(o: OpcionesEnso = {}) {
  const { cx = 100, cy = 100, r = 84, inicio = 118, barrido = 326 } = o;
  const p = (g: number) => { const a = (g * Math.PI) / 180; return `${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`; };
  // Dos arcos (un arco SVG no puede pasar de 360° ni ser ambiguo cerca de 180°).
  const medio = inicio + barrido / 2;
  return `M${p(inicio)}A${r} ${r} 0 0 1 ${p(medio)}A${r} ${r} 0 0 1 ${p(inicio + barrido)}`;
}

export type Chispa = { angulo: number; desde: number; hasta: number; tam: number; giro: number; retraso: number; alargada: boolean };

/**
 * Chispas de hoja de oro alrededor del ensō al aterrizar el platillo. Nunca más de 12.
 * `radio` es el radio del ensō en px: nacen sobre el anillo y salen hacia afuera.
 */
export function chispas(n: number, radio: number, semilla = 7): Chispa[] {
  const total = Math.max(0, Math.min(12, Math.floor(n)));
  const rnd = azar(semilla);
  return Array.from({ length: total }, (_, i) => {
    // Repartidas alrededor del anillo, con un poco de desorden.
    const angulo = ((i / total) * 360 + (rnd() - 0.5) * (300 / Math.max(1, total)) + 360) % 360;
    const desde = radio * (0.9 + rnd() * 0.12);
    return {
      angulo: r2(angulo),
      desde: r2(desde),
      hasta: r2(desde + radio * (0.26 + rnd() * 0.34)),
      tam: r2(5 + rnd() * 5),
      giro: Math.round((rnd() - 0.5) * 300),
      retraso: Math.round(rnd() * 90),
      alargada: i % 3 === 0,
    };
  });
}

export type Pieza = { tipo: 'digito'; v: number } | { tipo: 'texto'; t: string };

/** Separa un precio («$1,250») en dígitos que ruedan y signos fijos. */
export function rodillo(texto: string): Pieza[] {
  return [...texto].map((c) => (c >= '0' && c <= '9' ? { tipo: 'digito', v: Number(c) } : { tipo: 'texto', t: c }));
}

/** Lo que muestra el contador de la bolsa. */
export const contadorVisible = (n: number) => (n > 99 ? '99+' : String(Math.max(0, Math.floor(n))));

/** Etiqueta accesible del botón del pedido (isla y barra superior). */
export function etiquetaPedido(n: number, total: string, idioma: 'es' | 'en') {
  if (idioma === 'en') return n === 0 ? 'My order: empty' : `My order: ${n} ${n === 1 ? 'item' : 'items'}, ${total}`;
  return n === 0 ? 'Mi pedido: vacío' : `Mi pedido: ${n} ${n === 1 ? 'artículo' : 'artículos'}, ${total}`;
}

/**
 * Punto alto del arco de la miniatura que vuela a la bolsa. `dx`/`dy` van del destino al
 * origen (px). Sube más cuanto más lejos está, con tope, y siempre sube (nunca baja de 0).
 */
export function alzaArco(dx: number, dy: number) {
  const d = Math.hypot(dx, dy);
  return Math.round(Math.min(150, Math.max(56, d * 0.22 + Math.abs(dy) * 0.12)));
}
