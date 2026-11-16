// "Abierto ahora" en la portada, en Visítanos y en el horario de la semana.
import { ahoraEn, estadoLocal, h12, relojHoy } from '../lib/horario';
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
  // Reloj ensō de la portada: arco del servicio, aguja en la hora actual y cuenta regresiva.
  const hoy = $<HTMLElement>('.hoy-mk');
  if (hoy) {
    const r = relojHoy(datos.horario, ahora);
    hoy.dataset.abierto = r.abierto ? 'si' : 'no';
    hoy.style.setProperty('--inicio', String(r.arco?.inicio ?? 0));
    hoy.style.setProperty('--largo', String(r.arco?.largo ?? 0));
    hoy.style.setProperty('--desde', String(r.arco?.inicio ?? r.aguja));
    hoy.style.setProperty('--aguja', String(r.aguja));
    const t = $('[data-hoy-estado] .texto', hoy);
    if (t) ponerBi(t, r.texto.es, r.texto.en);
  }
  $$('#horario [data-dia]').forEach((li) => li.classList.toggle('hoy', Number(li.dataset.dia) === ahora.dia));
  return e;
}
