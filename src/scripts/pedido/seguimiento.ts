// Vista de seguimiento después de mandar la comanda por WhatsApp.
// Las etapas son ESTIMADAS (src/lib/seguimiento.ts); el estado real lo confirma
// el restaurante por WhatsApp. Todo el texto entra con textContent.
import { ahoraEn, h12, hhmm } from '../../lib/horario';
import { lineaPago } from '../../lib/pago';
import { precio } from '../../lib/precios';
import { enlacePregunta, etapaEstimada, type PedidoEnviado } from '../../lib/seguimiento';
import { $, ponerBi } from '../comun';

/** "7:42 pm" en la hora de Sonora. */
export const horaDe = (ms: number) => h12(hhmm(ahoraEn(new Date(ms)).min), true);

const MODO = {
  mesa: { es: 'En mesa', en: 'Dine-in' },
  llevar: { es: 'Para llevar', en: 'Pickup' },
  domicilio: { es: 'A domicilio', en: 'Delivery' },
} as const;

export function pintarSeguimiento(raiz: HTMLElement, p: PedidoEnviado, whatsapp: string, idioma: 'es' | 'en', ahora = Date.now()) {
  $('#pd-seg-folio', raiz)!.textContent = p.folio;
  ponerBi($('#pd-seg-hora', raiz)!, `Enviado a las ${horaDe(p.t)}`, `Sent at ${horaDe(p.t)}`);

  const { etapas, actual } = etapaEstimada(p.modo, p.t, ahora, p.listo);
  const ol = $('#pd-linea-tiempo', raiz)!;
  ol.replaceChildren(...etapas.map((e, i) => {
    const li = document.createElement('li');
    li.className = 'pd-etapa';
    li.dataset.estado = i < actual ? 'hecha' : i === actual ? 'actual' : 'pendiente';
    if (i === actual) li.setAttribute('aria-current', 'step');
    li.style.setProperty('--k', String(i));
    const punto = document.createElement('span');
    punto.className = 'pd-etapa-punto';
    punto.setAttribute('aria-hidden', 'true');
    if (i <= actual) punto.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'min-w-0 flex-1';
    const t = document.createElement('p'); t.className = 'pd-etapa-t'; ponerBi(t, e.titulo.es, e.titulo.en);
    const d = document.createElement('p'); d.className = 'pd-etapa-d'; ponerBi(d, e.detalle.es, e.detalle.en);
    cuerpo.append(t, d);
    const h = document.createElement('p');
    h.className = 'pd-etapa-h tabular-nums';
    if (e.estimado) ponerBi(h, `≈ ${horaDe(e.ms)} · estimado`, `≈ ${horaDe(e.ms)} · estimate`);
    else h.textContent = horaDe(e.ms);
    li.append(punto, cuerpo, h);
    return li;
  }));

  const m = MODO[p.modo];
  const extra = p.modo === 'mesa' && p.mesa ? { es: ` · Mesa ${p.mesa}`, en: ` · Table ${p.mesa}` }
    : p.modo === 'llevar' ? (p.hora === 'pronto' ? { es: ' · lo antes posible', en: ' · as soon as possible' } : { es: ` · ${h12(p.hora, true)}`, en: ` · ${h12(p.hora, true)}` })
    : { es: '', en: '' };
  ponerBi($('#pd-seg-entrega', raiz)!, m.es + extra.es, m.en + extra.en);
  $('#pd-seg-lineas', raiz)!.replaceChildren(...p.lineas.map((l) => {
    const li = document.createElement('li');
    li.className = 'flex gap-2';
    const n = document.createElement('span'); n.className = 'tabular-nums text-oro-claro'; n.textContent = `${l.n}×`;
    const nom = document.createElement('span'); nom.className = 'min-w-0 flex-1';
    ponerBi(nom, l.nombre.es + (l.op ? ` (${l.op.es})` : ''), l.nombre.en + (l.op ? ` (${l.op.en})` : ''));
    li.append(n, nom);
    return li;
  }));
  $('#pd-seg-total', raiz)!.textContent = precio(p.total);
  const pago = (i: 'es' | 'en') => lineaPago(p.pago, p.paga, p.modo, p.total, i);
  ponerBi($('#pd-seg-pago', raiz)!, pago('es'), pago('en'));
  $<HTMLAnchorElement>('#pd-preguntar', raiz)!.href = enlacePregunta(whatsapp, p.folio, idioma);
  $<HTMLAnchorElement>('#pd-reenviar', raiz)!.href = p.url;
}
