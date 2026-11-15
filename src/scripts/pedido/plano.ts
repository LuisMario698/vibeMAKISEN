// Interacción del plano de mesas: cada mesa es un <button> real (aria-pressed).
// Las ocupadas (disponibilidad de demostración) se pueden enfocar y explican por qué
// no se eligen; la mesa que llega por el QR siempre se acepta.
import type { MesaPlano, PlanoMesas } from '../../lib/plano';
import { $$, anunciar, reducir } from '../comun';
import { sacudir } from './movimiento';

/** Lee el plano desde el HTML que pintó PedidoPlano.astro. */
export function leerPlano(raiz: HTMLElement): PlanoMesas {
  const mesas: MesaPlano[] = $$<HTMLButtonElement>('.pd-mesa', raiz).map((b) => ({
    n: Number(b.dataset.mesa), x: 0, y: 0, forma: b.dataset.forma as MesaPlano['forma'], personas: Number(b.dataset.personas),
    zona: { es: b.dataset.zonaEs ?? '', en: b.dataset.zonaEn ?? '' },
  }));
  const ocupadasDemo = $$<HTMLButtonElement>('.pd-mesa[data-ocupada]', raiz).map((b) => Number(b.dataset.mesa));
  return { ancho: 1, alto: 1, mesas, ocupadasDemo };
}

export function crearPlano(raiz: HTMLElement, alElegir: (n: number) => void) {
  const botones = $$<HTMLButtonElement>('.pd-mesa', raiz);
  const sillas = $$<SVGGElement>('.pd-sillas', raiz);

  function marcar(mesa: number | null, deQR: boolean) {
    for (const b of botones) {
      const n = Number(b.dataset.mesa);
      const tuya = n === mesa;
      b.setAttribute('aria-pressed', String(tuya));
      // La mesa del QR es "tuya" aunque la demostración la marque ocupada.
      const ocupada = b.dataset.ocupada === 'si' && !(tuya && deQR);
      if (ocupada) b.setAttribute('aria-disabled', 'true'); else b.removeAttribute('aria-disabled');
      b.classList.toggle('qr', tuya && deQR);
    }
    for (const g of sillas) g.classList.toggle('sel', Number(g.dataset.sillas) === mesa);
  }

  raiz.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.pd-mesa');
    if (!b) return;
    const n = Number(b.dataset.mesa);
    if (b.getAttribute('aria-disabled') === 'true') {
      sacudir(b);
      anunciar(`La mesa ${n} está ocupada (disponibilidad de demostración). Elige una libre.`, `Table ${n} is taken (demo availability). Pick a free one.`);
      return;
    }
    alElegir(n);
    if (!reducir()) {
      b.querySelector('.pd-mesa-tapa')?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }],
        { duration: 460, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' },
      );
      const onda = document.createElement('span');
      onda.className = 'pd-mesa-onda';
      onda.setAttribute('aria-hidden', 'true');
      b.append(onda);
      onda.animate([{ opacity: 0.9, transform: 'translate(-50%, -50%) scale(0.6)' }, { opacity: 0, transform: 'translate(-50%, -50%) scale(2.1)' }], { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
        .finished.finally(() => onda.remove());
    }
  });

  return { marcar };
}
