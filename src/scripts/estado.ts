// "Abierto ahora" en la portada, en Visítanos y en el horario de la semana.
import { ahoraEn, estadoLocal, h12 } from '../lib/horario';
import { $, $$, datos, ponerBi } from './comun';

export function pintarEstado() {
  const ahora = ahoraEn();
  const e = estadoLocal(datos.horario, ahora);
  $$('[data-estado-local]').forEach((el) => {
    $('.punto', el)!.className = `punto relative size-2 rounded-full ${e.abierto ? 'punto-vivo text-abierto' : 'text-cerrado'}`;
    ponerBi($('.texto', el)!, e.texto.es, e.texto.en);
  });
  const hoyEl = $('[data-hoy]');
  if (hoyEl) {
    if (e.hoy) hoyEl.textContent = `${h12(e.hoy.abre).replace(' pm', '')}–${h12(e.hoy.cierra)}`;
    else ponerBi(hoyEl, 'Cerrado', 'Closed');
  }
  $$('#horario [data-dia]').forEach((li) => li.classList.toggle('hoy', Number(li.dataset.dia) === ahora.dia));
  return e;
}
