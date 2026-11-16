// Movimiento del panel "Mi pedido": FLIP de las tarjetas, números que ruedan y
// entrada de vistas. Solo transform/opacity; con movimiento reducido no se anima nada.
import { reducir } from '../comun';

export const SALIDA = 'cubic-bezier(0.16, 1, 0.3, 1)';
export const CAJON = 'cubic-bezier(0.32, 0.72, 0, 1)';

/** Posición de cada tarjeta (por su clave) antes de volver a pintar. */
export function capturar(ul: HTMLElement): Map<string, number> {
  const m = new Map<string, number>();
  for (const li of ul.children as HTMLCollectionOf<HTMLElement>) if (li.dataset.k) m.set(li.dataset.k, li.getBoundingClientRect().top);
  return m;
}

/**
 * Después de pintar: las tarjetas que ya estaban se deslizan desde su lugar anterior
 * (FLIP) y las nuevas entran. `entrar` = false evita la entrada (primer pintado).
 */
export function animarLista(ul: HTMLElement, antes: Map<string, number>, entrar = true) {
  if (reducir() || antes.size === 0) return;
  let k = 0;
  for (const li of ul.children as HTMLCollectionOf<HTMLElement>) {
    const y0 = antes.get(li.dataset.k ?? '');
    if (y0 === undefined) {
      if (!entrar) continue;
      li.animate([{ opacity: 0, transform: 'translateY(12px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { duration: 280, delay: k++ * 30, easing: SALIDA, fill: 'backwards' });
      continue;
    }
    const dy = y0 - li.getBoundingClientRect().top;
    if (Math.abs(dy) > 1) li.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 300, easing: SALIDA });
  }
}

/** Saca una tarjeta (antes de quitarla del estado). */
export function salir(li: HTMLElement): Promise<void> {
  if (reducir()) return Promise.resolve();
  li.dataset.saliendo = '1';
  return li.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateX(-20px)' }], { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
    .finished.then(() => undefined, () => undefined);
}

/** Cambia el texto de un número con un pequeño giro vertical (odómetro). Sube si aumenta. */
export function rodar(el: HTMLElement, texto: string, sube = true) {
  if (el.textContent === texto) return;
  el.textContent = texto;
  if (reducir() || !el.isConnected || !el.getClientRects().length) return;
  const d = sube ? 1 : -1;
  el.animate([{ opacity: 0, transform: `translateY(${0.55 * d}em)` }, { opacity: 1, transform: 'none' }], { duration: 340, easing: SALIDA });
}

/** Entrada de una vista del panel desde la dirección del paso (1 = adelante, -1 = atrás). */
export function entrarVista(el: HTMLElement, dir: number) {
  if (reducir()) return;
  // Sobrio y rápido: 16 px desde el lado del paso, 240 ms, escalonado corto (máx. 4 piezas).
  const hijos = [...el.children].filter((h) => !(h as HTMLElement).hidden && !h.classList.contains('sr-only')).slice(0, 4) as HTMLElement[];
  hijos.forEach((h, i) => h.animate(
    [{ opacity: 0, transform: `translateX(${dir * 16}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 240, delay: i * 30, easing: SALIDA, fill: 'backwards' },
  ));
}

/** Pulso corto de "mira aquí" (una mesa ocupada, un campo con error). */
export function sacudir(el: HTMLElement) {
  if (reducir()) return;
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' }, { transform: 'translateX(0)' }], { duration: 320, easing: 'ease-out' });
}
