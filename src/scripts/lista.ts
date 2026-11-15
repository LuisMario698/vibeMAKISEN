// Interfaz de "Mi pedido" (antes "Mi lista"): tres pasos (pedido, entrega, pago),
// comanda por WhatsApp y vista de seguimiento. La lógica (agregar, sanear, validar,
// mensaje, pago, folio, etapas) está en src/lib/; aquí solo se guarda, se pinta y se
// conecta con el DOM. Nunca se usa innerHTML con texto del cliente.
import { ahoraEn, estadoLocal, h12, minutos, ranurasHoy } from '../lib/horario';
import { leerMesa, sinMesa } from '../lib/mesa';
import { cambio, dondeTerminal, montosSugeridos, montoValido, sanearPaga, type FormaPago } from '../lib/pago';
import {
  agregar as agregarLinea, cambiar, cambiarNota, clave, enlaceWhatsApp, LIMITES, MENSAJES_ERROR, PASO_DE, piezas, restaurar,
  sanear, subtotal, validar, vigentes, type Aviso, type Campo, type Catalogo, type ErrorAgregar, type Errores, type Linea, type Lista, type Modo,
} from '../lib/pedido';
import { estadoMesa, mesaDePlano, mesaValida, puedeElegir } from '../lib/plano';
import { precio, usd } from '../lib/precios';
import { crearFolio, esFolio, HORAS_PEDIDO, sanearPedido, type PedidoEnviado } from '../lib/seguimiento';
import { distanciaKm, lejos, redondear, type Coordenada } from '../lib/ubicacion';
import { $, $$, anunciar, avisar, datos, guardar, html, idioma, ponerBi, reducir } from './comun';
import type { Agregado } from './hoja';
import { lectura as lecturaHora, pintarHoras } from './pedido/horas';
import type { Mapa } from './pedido/mapa';
import { animarLista, capturar, entrarVista, rodar, sacudir, salir } from './pedido/movimiento';
import { crearPlano, leerPlano } from './pedido/plano';
import { pintarSeguimiento } from './pedido/seguimiento';

const CLAVE = 'makizen-lista';
const CLAVE_PEDIDO = 'makizen-pedido';
const CLAVE_MESA = 'makizen-mesa';
const CLAVE_MESA_QR = 'makizen-mesa-qr';

type Paso = 1 | 2 | 3;
type Vista = Paso | 'seguimiento';
const CAMPOS_ENTREGA = ['mesa', 'nombre', 'hora', 'direccion'] as const;

const azar = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32; } catch { return Math.random(); } };
const ICONOS_ENTREGA: Record<Modo, string> = {
  mesa: 'M5 11h14M7 11v8M17 11v8M9 7.5h6M12 7.5V11M4 21h4M16 21h4',
  llevar: 'M5.5 8.5h13l-1 11.5h-11zM9 8.5V7a3 3 0 0 1 6 0v1.5M9.5 13.5h5',
  domicilio: 'M6 18.5a2.2 2.2 0 1 0 0-.1M17.5 18.5a2.2 2.2 0 1 0 0-.1M8.2 18.5h7.1l2.1-5.5h-4.6l-1.6 3.4H4.4M16.3 13l-1.1-4h-2.4M3 8.5h6V13H3z',
};

export function crearLista(o: { alCambiar: (piezas: number, total: number) => void }) {
  const catalogo: Catalogo = new Map(datos.platillos.map((p) => [p.id, { nombre: p.nombre, precio: p.precio, agotado: p.agotado, opciones: p.opciones }]));
  const porId = new Map(datos.platillos.map((p) => [p.id, p]));
  const dlg = $<HTMLDialogElement>('#lista')!;
  const panel = $('.lista-panel', dlg)!;
  const scroll = $('.lista-scroll', dlg)!;
  const ul = $('#lista-lineas', dlg)!;
  const vacia = $('#lista-vacia', dlg)!;
  const form = $<HTMLFormElement>('#lista-form', dlg)!;
  const avisosEl = $('#lista-avisos', dlg)!;
  const resumen = $('#lista-resumen', dlg)!;
  const subEl = $('#lista-subtotal', dlg)!;
  const usdEl = $('#lista-usd', dlg)!;
  const errores = $('#lista-errores', dlg)!;
  const enviar = $<HTMLAnchorElement>('#lista-enviar', dlg)!;
  const seguir = $<HTMLButtonElement>('#pd-seguir', dlg)!;
  const atras = $<HTMLButtonElement>('#pd-atras', dlg)!;
  const pie = $('.lista-pie', dlg)!;
  const tpl = $<HTMLTemplateElement>('#tpl-linea')!;
  const bandaEnviado = $<HTMLButtonElement>('#pd-hay-enviado', dlg)!;
  const barraDeshacer = $('#pd-deshacer', dlg)!;
  const inp = {
    mesa: $<HTMLInputElement>('#lista-mesa', dlg)!,
    nombre: $<HTMLInputElement>('#lista-nombre', dlg)!,
    hora: $('#lista-hora', dlg)!,
    direccion: $<HTMLTextAreaElement>('#lista-direccion', dlg)!,
    referencias: $<HTMLInputElement>('#lista-referencias', dlg)!,
    otro: $<HTMLInputElement>('#pd-paga-otro', dlg)!,
  };
  const planoEl = $('[data-plano]', dlg)!;
  const plano = leerPlano(planoEl);
  const mapaEl = $('#pd-mapa', dlg)!;
  const centro: Coordenada = { lat: Number(mapaEl.dataset.lat), lng: Number(mapaEl.dataset.lng) };

  /* ── Mesa desde el QR: se guarda en la sesión y se quita de la URL ── */
  const deQR = leerMesa(location.search);
  if (deQR) {
    guardar.escribir(CLAVE_MESA, String(deQR), true);
    guardar.escribir(CLAVE_MESA_QR, '1', true);
    history.replaceState(history.state, '', sinMesa(location.href));
  }
  const mesaGuardada = Number(guardar.leer(CLAVE_MESA, true));
  let mesa: number | null = mesaValida(mesaGuardada) ? mesaGuardada : null;
  let mesaDeQR = mesa !== null && guardar.leer(CLAVE_MESA_QR, true) === '1';

  /* ── Estado guardado, saneado contra el menú vigente ── */
  const leer = (k: string) => { try { return JSON.parse(guardar.leer(k) ?? 'null'); } catch { return null; } };
  let { lista, avisos } = sanear(leer(CLAVE), catalogo, Date.now());
  if (mesa && lista.lineas.length === 0) lista = { ...lista, modo: 'mesa' };
  let enviado: PedidoEnviado | null = sanearPedido(leer(CLAVE_PEDIDO), Date.now());
  if (!enviado) guardar.borrar(CLAVE_PEDIDO);
  let vista: Vista = 1;
  const intentado = new Set<Paso>();

  const persistir = () => {
    if (lista.lineas.length === 0 && !lista.nombre && !lista.direccion) guardar.borrar(CLAVE);
    else guardar.escribir(CLAVE, JSON.stringify(lista));
  };
  const actualizar = (cambios: Partial<Lista>) => { lista = { ...lista, ...cambios, t: Date.now() }; persistir(); };
  const entrega = () => ({
    modo: lista.modo, nombre: lista.nombre, hora: lista.hora, direccion: lista.direccion, referencias: lista.referencias,
    mesa, ubic: lista.ubic, pago: lista.pago, paga: lista.paga, folio: lista.folio,
  });
  const hayVigentes = () => vigentes(lista, catalogo).length > 0;
  const ranuras = () => ranurasHoy(datos.horario, ahoraEn());
  const en = () => idioma() === 'en';

  /** Errores de validación más la regla del plano (una mesa ocupada no se elige, salvo la del QR). */
  function errores_(): Errores {
    const err = validar(lista, catalogo, entrega(), ranuras());
    if (lista.modo === 'mesa' && !err.mesa && mesa !== null && !puedeElegir(plano, mesa, mesaDeQR)) err.mesa = 'ocupada';
    return err;
  }
  const mensajeError = (c: Campo, err: Errores): [string, string] => {
    if (c === 'mesa' && err.mesa === 'ocupada') return [`La mesa ${mesa} aparece ocupada. Elige una libre en el plano.`, `Table ${mesa} shows as taken. Pick a free one on the plan.`];
    if (c === 'paga') { const t = precio(subtotal(lista, catalogo)); return [`El monto con que pagas debe cubrir el total (${t}).`, `The cash amount must cover the total (${t}).`]; }
    return [MENSAJES_ERROR[c].es, MENSAJES_ERROR[c].en];
  };

  /* ── Miniatura de cada línea: recorte de la cartilla, foto real o icono de su categoría ── */
  function miniatura(img: HTMLImageElement, id: string) {
    const p = porId.get(id);
    const marco = img.parentElement!;
    if (p?.foto && datos.fotos[p.foto]) { img.src = `/menu/${p.foto}.webp`; marco.dataset.modo = 'recorte'; }
    else if (datos.reales[id]) { img.src = datos.reales[id]!.src; marco.dataset.modo = 'foto'; }
    else { img.src = (p && datos.iconos[p.catId]) || '/brand/isotipo.svg'; marco.dataset.modo = 'icono'; }
  }

  /* ── Pintar ── */
  function textoAviso(a: Aviso): [string, string] {
    const c = catalogo.get(a.id);
    const nom = c?.nombre ?? { es: 'Un platillo', en: 'An item' };
    if (a.tipo === 'quitado') return ['Quitamos un platillo que ya no está en el menú.', 'We removed an item that is no longer on the menu.'];
    if (a.tipo === 'agotado') return [`${nom.es} se agotó y no entra al pedido.`, `${nom.en} is sold out and won't be included.`];
    return [`${nom.es} cambió de precio: antes ${precio(a.antes)}, ahora ${precio(a.despues)}.`, `${nom.en} changed price: was ${precio(a.antes)}, now ${precio(a.despues)}.`];
  }
  function pintarAvisos() {
    avisosEl.replaceChildren(...avisos.map((a) => {
      const p = document.createElement('p');
      p.className = 'aviso';
      const [es, ing] = textoAviso(a);
      ponerBi(p, es, ing);
      return p;
    }));
  }

  let notaAbierta: string | null = null;
  function pintarLineas() {
    const frag = document.createDocumentFragment();
    const ing = en();
    lista.lineas.forEach((l, i) => {
      const c = catalogo.get(l.id);
      if (!c) return;
      const li = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      li.dataset.i = String(i);
      li.dataset.k = clave(l);
      li.style.setProperty('--k', String(i));
      li.classList.toggle('agotada', c.agotado);
      miniatura($<HTMLImageElement>('.ll-foto img', li)!, l.id);
      ponerBi($('.ll-nombre', li)!, c.nombre.es, c.nombre.en);
      const op = l.op ? c.opciones?.valores.find((v) => v.id === l.op) : undefined;
      if (op) { const e = $('.ll-op', li)!; e.hidden = false; ponerBi(e, op.nombre.es, op.nombre.en); }
      if (l.nota) { const e = $('.ll-nota', li)!; e.hidden = false; e.textContent = `“${l.nota}”`; }
      if (c.agotado) { const e = $('.ll-estado', li)!; e.hidden = false; ponerBi(e, 'Agotado hoy · no entra al pedido', 'Sold out today · not included'); }
      $('.ll-precio', li)!.textContent = precio(c.precio * l.n);
      $('output', li)!.textContent = String(l.n);
      const nombre = c.nombre[idioma()];
      const grupo = $('.pd-stepper', li)!;
      grupo.setAttribute('aria-label', `${ing ? 'Quantity of' : 'Cantidad de'} ${nombre}`);
      const menos = $<HTMLButtonElement>('[data-l="menos"]', li)!;
      menos.setAttribute('aria-label', l.n <= 1 ? (ing ? `Remove ${nombre}` : `Quitar ${nombre}`) : (ing ? 'One less' : 'Uno menos'));
      const mas = $<HTMLButtonElement>('[data-l="mas"]', li)!;
      mas.setAttribute('aria-label', ing ? 'One more' : 'Uno más');
      mas.disabled = l.n >= LIMITES.cantidad || c.agotado;
      $('[data-l="quitar"]', li)!.setAttribute('aria-label', ing ? `Remove ${nombre}` : `Quitar ${nombre}`);
      const bNota = $<HTMLButtonElement>('[data-l="nota"]', li)!;
      ponerBi($('.ll-nota-rotulo', li)!, l.nota ? 'Editar nota' : 'Agregar nota', l.nota ? 'Edit note' : 'Add note');
      bNota.setAttribute('aria-label', `${l.nota ? (ing ? 'Edit note for' : 'Editar nota de') : (ing ? 'Add a note for' : 'Agregar nota a')} ${nombre}`);
      const editor = $('.ll-editar', li)!;
      const campoNota = $<HTMLInputElement>('input', editor)!;
      campoNota.id = `ll-nota-${i}`;
      $('label', editor)!.setAttribute('for', campoNota.id);
      campoNota.placeholder = ing ? 'E.g. no onion, sauce on the side' : 'Ej. sin cebolla, salsa aparte';
      if (notaAbierta === li.dataset.k) { editor.hidden = false; campoNota.value = l.nota ?? ''; bNota.setAttribute('aria-expanded', 'true'); }
      frag.append(li);
    });
    ul.replaceChildren(frag);
  }

  /** Hora para llevar: ranuras de hoy; una hora elegida que venció se queda visible para explicar el error. */
  function pintarHora(conservar = false) {
    const r = ranuras();
    const ahora = ahoraEn();
    const actual = lista.hora;
    const vigente = actual === 'pronto' || r.includes(actual);
    let vencida: string | null = null;
    if (!vigente && conservar && /^\d{2}:\d{2}$/.test(actual)) vencida = actual;
    else if (!vigente) lista = { ...lista, hora: 'pronto' };
    const est = estadoLocal(datos.horario, ahora);
    pintarHoras({ cont: inp.hora, lectura: $('#pd-hora-lectura', dlg)!, ranuras: r, actual: lista.hora, ahora, vencida, sinHoras: r.length ? null : est.texto });
  }

  function pintarMesa() {
    planoUI.marcar(mesa, mesaDeQR);
    if (document.activeElement !== inp.mesa) inp.mesa.value = mesa && !mesaDePlano(plano, mesa) ? String(mesa) : '';
    const chip = $('#pd-mesa-elegida', dlg)!;
    const ayuda = $('#ayuda-mesa', dlg)!;
    const m = mesa ? mesaDePlano(plano, mesa) : undefined;
    chip.hidden = !mesa;
    if (mesa) {
      const fuerte = document.createElement('strong');
      ponerBi(fuerte, `Mesa ${mesa}`, `Table ${mesa}`);
      const det = document.createElement('span');
      if (m) ponerBi(det, `${m.personas} personas · ${m.zona.es}`, `Seats ${m.personas} · ${m.zona.en}`);
      else ponerBi(det, 'Fuera del plano ilustrativo', 'Not on the illustrative plan');
      const parts: Node[] = [fuerte, det];
      if (mesaDeQR) { const q = document.createElement('span'); q.className = 'pd-insignia'; ponerBi(q, 'Desde el QR', 'From the QR'); parts.push(q); }
      chip.replaceChildren(...parts);
    }
    ayuda.hidden = !(mesa && !m);
    if (mesa && !m) ponerBi(ayuda, mesaDeQR ? `La mesa ${mesa} no aparece en el plano ilustrativo; la tomamos del QR de tu mesa.` : `La mesa ${mesa} no aparece en el plano ilustrativo; el restaurante la confirma.`,
      mesaDeQR ? `Table ${mesa} isn't on the illustrative plan; we took it from your table's QR.` : `Table ${mesa} isn't on the illustrative plan; the restaurant will confirm it.`);
  }

  function pintarFormulario() {
    $$<HTMLInputElement>('input[name="modo"]', form).forEach((r) => (r.checked = r.value === lista.modo));
    form.dataset.modo = lista.modo;
    $$('[data-campo]', form).forEach((c) => {
      const campo = c.dataset.campo!;
      c.hidden = !(campo === 'mesa' ? lista.modo === 'mesa' : campo === 'nombre' ? lista.modo !== 'mesa' : campo === 'hora' ? lista.modo === 'llevar' : lista.modo === 'domicilio');
    });
    if (document.activeElement !== inp.nombre) inp.nombre.value = lista.nombre;
    if (document.activeElement !== inp.direccion) inp.direccion.value = lista.direccion;
    if (document.activeElement !== inp.referencias) inp.referencias.value = lista.referencias;
    pintarMesa();
    const est = estadoLocal(datos.horario, ahoraEn());
    const cerrado = $('#lista-cerrado', form)!;
    cerrado.hidden = est.abierto;
    if (!est.abierto) ponerBi(cerrado, `Ahora estamos cerrados (${est.texto.es.replace('Cerrado · ', '')}). Puedes mandar tu pedido y te contestamos al abrir.`, `We're closed right now (${est.texto.en.replace('Closed · ', '')}). You can send your order and we'll reply when we open.`);
    pintarUbicacion();
    $$<HTMLInputElement | HTMLTextAreaElement>('[data-ph-es]', dlg).forEach((e) => (e.placeholder = en() ? e.dataset.phEn! : e.dataset.phEs!));
  }

  /* ── Paso 3: resumen de la entrega y pago ── */
  function pintarPago() {
    const total = subtotal(lista, catalogo);
    $$<HTMLInputElement>('input[name="pago"]', dlg).forEach((r) => (r.checked = r.value === lista.pago));
    const dondeEs = dondeTerminal(lista.modo, 'es'); const dondeEn = dondeTerminal(lista.modo, 'en');
    ponerBi($('[data-sub-tarjeta]', dlg)!, dondeEs[0]!.toUpperCase() + dondeEs.slice(1), dondeEn[0]!.toUpperCase() + dondeEn.slice(1));
    const efe = $('#pd-efectivo', dlg)!; const tar = $('#pd-tarjeta', dlg)!;
    efe.hidden = lista.pago !== 'efectivo';
    tar.hidden = lista.pago !== 'tarjeta';
    const tt = { mesa: ['Llevamos la terminal a tu mesa cuando pidas la cuenta.', 'We bring the card terminal to your table when you ask for the check.'],
      llevar: ['Pagas con tarjeta en caja al recoger tu pedido.', 'Pay by card at the counter when you pick it up.'],
      domicilio: ['El repartidor lleva la terminal para cobrar al entregar.', 'The driver brings a card terminal and charges on delivery.'] }[lista.modo];
    ponerBi($('#pd-tarjeta-texto', dlg)!, tt[0]!, tt[1]!);

    // ¿Con cuánto pagas? Exacto, montos redondos y Otro.
    const sugeridos = montosSugeridos(total);
    const esOtro = typeof lista.paga === 'number' && !sugeridos.includes(lista.paga);
    const chips = $('#pd-montos', dlg)!;
    const opciones: [string, string, string][] = [['exacto', 'Exacto', 'Exact'], ...sugeridos.map((m) => [String(m), precio(m), precio(m)] as [string, string, string]), ['otro', 'Otro monto', 'Other amount']];
    chips.replaceChildren(...opciones.map(([v, es, ing]) => {
      const l = document.createElement('label');
      l.className = 'pd-chip presionable';
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'paga'; r.value = v; r.className = 'sr-only';
      r.checked = v === 'otro' ? esOtro : v === String(lista.paga);
      const s = document.createElement('span'); ponerBi(s, es, ing);
      l.append(r, s);
      return l;
    }));
    const otro = $('#pd-otro', dlg)!;
    otro.hidden = !esOtro && !otroAbierto;
    if (document.activeElement !== inp.otro) inp.otro.value = typeof lista.paga === 'number' && esOtro ? String(lista.paga) : inp.otro.value;
    const c = cambio(lista.paga, total);
    const cEl = $('#pd-cambio', dlg)!;
    cEl.hidden = !c;
    if (c) {
      const f = document.createElement('strong'); f.textContent = precio(c);
      const a = document.createElement('span'); ponerBi(a, lista.modo === 'domicilio' ? 'Cambio aproximado (sin envío): ' : 'Tu cambio: ', lista.modo === 'domicilio' ? 'Approx. change (before delivery fee): ' : 'Your change: ');
      cEl.replaceChildren(a, f);
    }
    pintarResumenEntrega();
  }
  let otroAbierto = false;

  function pintarResumenEntrega() {
    $('[data-icono-entrega]', dlg)!.setAttribute('d', ICONOS_ENTREGA[lista.modo]);
    const t = $('#pd-entrega-titulo', dlg)!; const d = $('#pd-entrega-detalle', dlg)!;
    if (lista.modo === 'mesa') {
      const m = mesa ? mesaDePlano(plano, mesa) : undefined;
      ponerBi(t, mesa ? `En mesa · Mesa ${mesa}` : 'En mesa', mesa ? `Dine-in · Table ${mesa}` : 'Dine-in');
      ponerBi(d, m ? m.zona.es : 'Elige tu mesa', m ? m.zona.en : 'Pick your table');
    } else if (lista.modo === 'llevar') {
      ponerBi(t, `Para llevar${lista.nombre ? ` · ${lista.nombre}` : ''}`, `Pickup${lista.nombre ? ` · ${lista.nombre}` : ''}`);
      ponerBi(d, lista.hora === 'pronto' ? 'Hoy, lo antes posible' : `Hoy a las ${h12(lista.hora, true)}`, lista.hora === 'pronto' ? 'Today, as soon as possible' : `Today at ${h12(lista.hora, true)}`);
    } else {
      ponerBi(t, `A domicilio${lista.nombre ? ` · ${lista.nombre}` : ''}`, `Delivery${lista.nombre ? ` · ${lista.nombre}` : ''}`);
      const pin = lista.ubic ? ' · con punto en el mapa' : '';
      ponerBi(d, (lista.direccion || 'Sin dirección') + pin, (lista.direccion || 'No address') + (lista.ubic ? ' · pinned on the map' : ''));
    }
  }

  /* ── Errores por paso y enlace de WhatsApp ── */
  function pintarErrores() {
    const err = errores_();
    for (const c of [...CAMPOS_ENTREGA, 'pago', 'paga'] as const) {
      const p = $(`#err-${c}`, dlg)!;
      const mostrar = intentado.has(PASO_DE[c]) && !!err[c];
      p.hidden = !mostrar;
      if (mostrar) { const [es, ing] = mensajeError(c, err); ponerBi(p, es, ing); }
      const campo = c === 'pago' ? null : c === 'paga' ? inp.otro : c === 'hora' ? inp.hora : inp[c];
      campo?.setAttribute('aria-invalid', String(mostrar));
    }
    let enlace: ReturnType<typeof enlaceWhatsApp>;
    try { enlace = enlaceWhatsApp(datos.whatsapp, lista, catalogo, entrega(), idioma()); } catch { enlace = { ok: false, motivo: 'larga' }; }
    const hay = Object.keys(err).length > 0;
    const listo = !hay && enlace.ok;
    enviar.href = enlace.ok && !hay ? enlace.url : '#';
    // Mensajes del paso visible (y del 2 si ya se intentó enviar desde el 3).
    const mensajes: [string, string][] = [];
    const v = vista;
    if (typeof v === "number" && intentado.has(v)) {
      (Object.keys(err) as Campo[]).filter((c) => PASO_DE[c] <= v && intentado.has(PASO_DE[c])).forEach((c) => mensajes.push(mensajeError(c, err)));
      if (v === 3 && !enlace.ok && enlace.motivo === 'larga') mensajes.push(['Tu pedido es muy largo para un solo mensaje. Divídelo en dos o llámanos.', 'Your order is too long for one message. Split it in two or call us.']);
    }
    errores.hidden = mensajes.length === 0;
    errores.replaceChildren(...mensajes.map(([es, ing]) => { const p = document.createElement('p'); ponerBi(p, es, ing); return p; }));
    if (mensajes.length && vista === 3) enviar.setAttribute('aria-describedby', 'lista-errores'); else enviar.removeAttribute('aria-describedby');
    return { err, enlace, listo };
  }

  function pintarPie() {
    const n = piezas(lista, catalogo);
    const sinLineas = lista.lineas.length === 0;
    dlg.dataset.paso = vista === 'seguimiento' ? 'seguimiento' : sinLineas ? 'vacio' : String(vista);
    pie.hidden = vista === 'seguimiento' || sinLineas;
    atras.hidden = vista === 1;
    seguir.hidden = vista === 3;
    enviar.hidden = vista !== 3;
    const txt = vista === 1 ? ['Continuar a la entrega', 'Continue to delivery'] : ['Continuar al pago', 'Continue to payment'];
    ponerBi($('#pd-seguir-texto', dlg)!, txt[0]!, txt[1]!);
    seguir.setAttribute('aria-disabled', String(vista === 1 && !hayVigentes()));
    $$<HTMLButtonElement>('[data-ir-paso]', dlg).forEach((b) => {
      const p = Number(b.dataset.irPaso);
      if (!b.classList.contains('pd-paso')) return;
      b.setAttribute('aria-current', p === vista ? 'step' : 'false');
      b.dataset.estado = typeof vista === 'number' && p < vista ? 'hecho' : p === vista ? 'actual' : 'pendiente';
    });
    panel.style.setProperty('--paso', String(typeof vista === 'number' ? vista - 1 : 2));
    const fol = vista === 3 && esFolio(lista.folio) ? lista.folio : '';
    if (vista === 'seguimiento' && enviado) resumen.textContent = enviado.folio;
    else ponerBi(resumen, `${n === 1 ? '1 artículo' : `${n} artículos`}${fol ? ` · folio ${fol}` : ''}`, `${n === 1 ? '1 item' : `${n} items`}${fol ? ` · order ${fol}` : ''}`);
    $('[data-titulo="pedido"]', dlg)!.hidden = vista === 'seguimiento';
    $('[data-titulo="enviado"]', dlg)!.hidden = vista !== 'seguimiento';
    bandaEnviado.hidden = !(enviado && vista === 1);
    if (enviado) $('[data-folio]', bandaEnviado)!.textContent = enviado.folio;
  }

  let totalPrevio = -1;
  function pintar(o2: { animar?: boolean } = {}) {
    const antes = o2.animar && dlg.open ? capturar(ul) : new Map<string, number>();
    const hay = lista.lineas.length > 0;
    if (hay && !esFolio(lista.folio)) actualizar({ folio: crearFolio(azar) });
    if (!hay && typeof vista === 'number' && vista > 1) vista = 1;
    vacia.hidden = hay;
    $$('[data-con-lineas]', dlg).forEach((e) => (e.hidden = !hay));
    pintarAvisos();
    pintarLineas();
    animarLista(ul, antes);
    pintarFormulario();
    pintarPago();
    const total = subtotal(lista, catalogo);
    const n = piezas(lista, catalogo);
    if (dlg.open) rodar(subEl, precio(total), total >= totalPrevio); else subEl.textContent = precio(total);
    totalPrevio = total;
    usdEl.textContent = total ? usd(total, datos.tc) : '';
    pintarPie();
    pintarErrores();
    mostrarVista(false);
    o.alCambiar(n, total);
  }

  /* ── Vistas y pasos ── */
  function mostrarVista(animar: boolean, dir = 1) {
    $$<HTMLElement>('[data-vista]', dlg).forEach((s) => {
      const v = s.dataset.vista === 'seguimiento' ? 'seguimiento' : Number(s.dataset.vista);
      const ver = v === vista;
      const cambia = s.hidden === ver;
      s.hidden = !ver;
      if (ver && cambia && animar) entrarVista(s, dir);
    });
    if (vista === 2 && lista.modo === 'domicilio') prepararMapa();
  }

  /** Primer paso con errores entre `desde` y `hasta` (para no saltarse validaciones). */
  function bloqueo(hasta: Paso): Paso | null {
    if (!hayVigentes()) return 1;
    const err = errores_();
    for (const p of [2, 3] as const) {
      if (p >= hasta) break;
      if ((Object.keys(err) as Campo[]).some((c) => PASO_DE[c] === p)) return p;
    }
    return null;
  }

  function irPaso(p: Paso, enfocar = true) {
    if (vista === p) return;
    const desde = typeof vista === 'number' ? vista : 1;
    const freno = p > desde ? bloqueo(p) : null;
    if (freno !== null && freno < p) {
      intentado.add(freno);
      if (freno !== vista) { vista = freno; pintarPie(); mostrarVista(true, freno > desde ? 1 : -1); }
      pintarErrores();
      enfocarError(freno);
      return;
    }
    if (p === 2 && lista.modo === 'llevar') pintarHora();
    vista = p;
    pintarPie();
    pintarErrores();
    mostrarVista(true, p > desde ? 1 : -1);
    scroll.scrollTop = 0; scroll.scrollLeft = 0;
    if (enfocar) $<HTMLElement>(`#t-paso${p}-h`, dlg)?.focus({ preventScroll: true });
  }

  function enfocarError(p: Paso) {
    const err = errores_();
    if (p === 1) { sacudir(seguir); return; }
    const c = (Object.keys(err) as Campo[]).find((k) => PASO_DE[k] === p);
    if (!c) return;
    const destino = c === 'mesa' ? (mesa === null ? $<HTMLElement>('.pd-mesa:not([aria-disabled])', dlg) : inp.mesa)
      : c === 'hora' ? $<HTMLElement>('input[name="hora"]:checked:not(:disabled), input[name="hora"]:not(:disabled)', dlg)
      : c === 'pago' ? $<HTMLElement>('input[name="pago"]', dlg)
      : c === 'paga' ? (otroAbierto ? inp.otro : $<HTMLElement>('input[name="paga"]', dlg))
      : inp[c as 'nombre' | 'direccion'];
    destino?.focus({ preventScroll: true });
    const caja = destino?.closest<HTMLElement>('.campo, .pd-bloque, fieldset');
    if (caja) { caja.scrollIntoView({ block: 'center', behavior: reducir() ? 'auto' : 'smooth' }); sacudir(caja); }
  }

  /* ── Mapa de entrega (Leaflet bajo demanda) ── */
  let mapa: Mapa | null = null;
  let cargandoMapa = false;
  const estadoMapa = $('#pd-mapa-estado', dlg)!;
  let mensajeMapa: [string, string] | null = null;
  function pintarUbicacion() {
    $('#pd-quitar-pin', dlg)!.hidden = !lista.ubic;
    const [es, ing] = mensajeMapa ?? (lista.ubic
      ? [`Punto fijado ✓ El repartidor recibe el enlace del mapa${lejos(lista.ubic, centro) ? ` (queda a ${Math.round(distanciaKm(lista.ubic, centro))} km del restaurante: revísalo)` : ''}.`,
        `Pin set ✓ The driver gets the map link${lejos(lista.ubic, centro) ? ` (it's ${Math.round(distanciaKm(lista.ubic, centro))} km from the restaurant: please check)` : ''}.`]
      : ['Toca el mapa donde está tu puerta (luego puedes arrastrar el pin) o usa tu ubicación. Si no, basta con tu dirección.', 'Tap the map where your door is (then drag the pin) or use your location. Your address alone also works.']);
    ponerBi(estadoMapa, es, ing);
    estadoMapa.classList.toggle('ok', !!lista.ubic && !mensajeMapa);
  }
  async function prepararMapa() {
    if (mapa) { requestAnimationFrame(() => mapa?.ajustar()); return; }
    if (cargandoMapa) return;
    cargandoMapa = true;
    try {
      const { crearMapa } = await import('./pedido/mapa');
      mapa = await crearMapa(mapaEl, {
        centro, inicial: lista.ubic,
        etiquetas: en() ? { pin: 'Delivery point', local: 'MAKIZEN (approximate)' } : { pin: 'Punto de entrega', local: 'MAKIZEN (aproximado)' },
        alMover: (c) => { mensajeMapa = null; actualizar({ ubic: redondear(c) }); pintarUbicacion(); pintarErrores(); anunciar('Punto de entrega fijado en el mapa.', 'Delivery pin set on the map.'); },
        alFallarTeselas: () => { mapaEl.dataset.sinTeselas = '1'; },
      });
      requestAnimationFrame(() => mapa?.ajustar());
    } catch {
      mapaEl.replaceChildren();
      const p = document.createElement('p');
      p.className = 'pd-mapa-cargando';
      ponerBi(p, 'No se pudo cargar el mapa. Escribe tu dirección y referencias, o usa tu ubicación.', "The map couldn't load. Type your address and landmarks, or use your location.");
      mapaEl.append(p);
    } finally { cargandoMapa = false; }
  }
  const btnUbic = $<HTMLButtonElement>('#pd-mi-ubicacion', dlg)!;
  btnUbic.addEventListener('click', () => {
    if (!('geolocation' in navigator)) { mensajeMapa = ['Tu navegador no permite compartir la ubicación. Mueve el pin a mano.', "Your browser can't share location. Move the pin by hand."]; pintarUbicacion(); return; }
    btnUbic.setAttribute('aria-busy', 'true');
    btnUbic.disabled = true;
    mensajeMapa = ['Buscando tu ubicación…', 'Finding your location…'];
    pintarUbicacion();
    navigator.geolocation.getCurrentPosition((pos) => {
      btnUbic.removeAttribute('aria-busy'); btnUbic.disabled = false;
      const c = redondear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      mensajeMapa = null;
      actualizar({ ubic: c });
      mapa?.mover(c, true);
      pintarUbicacion(); pintarErrores();
      anunciar('Usamos tu ubicación actual para la entrega.', 'We used your current location for delivery.');
    }, (e) => {
      btnUbic.removeAttribute('aria-busy'); btnUbic.disabled = false;
      mensajeMapa = e.code === 1
        ? ['No diste permiso de ubicación. Puedes activarlo en tu navegador o mover el pin a mano.', 'Location permission was denied. Turn it on in your browser or move the pin by hand.']
        : e.code === 3
          ? ['Tardó demasiado en ubicarte. Inténtalo otra vez o mueve el pin.', 'Finding you took too long. Try again or move the pin.']
          : ['No pudimos ubicarte. Mueve el pin a mano o escribe referencias.', "We couldn't find you. Move the pin by hand or add landmarks."];
      pintarUbicacion();
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  });
  $('#pd-quitar-pin', dlg)!.addEventListener('click', () => {
    mensajeMapa = null;
    actualizar({ ubic: null });
    mapa?.quitar();
    pintarUbicacion(); pintarErrores();
    btnUbic.focus();
  });

  /* ── Plano de mesas ── */
  const planoUI = crearPlano(planoEl, (n) => {
    mesa = n; mesaDeQR = false;
    guardar.borrar(CLAVE_MESA_QR, true);
    guardar.escribir(CLAVE_MESA, String(n), true);
    inp.mesa.value = '';
    pintarMesa(); pintarErrores();
    const m = mesaDePlano(plano, n)!;
    anunciar(`Mesa ${n} elegida: ${m.personas} personas, ${m.zona.es}.`, `Table ${n} selected: seats ${m.personas}, ${m.zona.en}.`);
  });

  // Enfocar un radio oculto puede intentar desplazar el panel en horizontal: siempre vuelve a 0.
  scroll.addEventListener('scroll', () => { if (scroll.scrollLeft) scroll.scrollLeft = 0; }, { passive: true });

  /* ── Abrir y cerrar ── */
  let foco: HTMLElement | null = null;
  function abrir() {
    if (dlg.open) return;
    foco = document.activeElement as HTMLElement;
    enviado = sanearPedido(leer(CLAVE_PEDIDO), Date.now());
    vista = lista.lineas.length === 0 && enviado ? 'seguimiento' : 1;
    intentado.clear();
    otroAbierto = false;
    pintarHora();
    if (vista === 'seguimiento') pintarSeguimientoVista();
    totalPrevio = subtotal(lista, catalogo);
    pintar();
    dlg.classList.add('entrando');
    setTimeout(() => dlg.classList.remove('entrando'), 900);
    dlg.showModal();
    html.classList.add('bloqueo');
    scroll.scrollTop = 0;
  }
  async function cerrar() {
    if (!dlg.open) return;
    if (!reducir()) {
      dlg.classList.add('cerrando');
      await panel.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 220 }).finished;
      dlg.classList.remove('cerrando');
    }
    dlg.close();
    ocultarDeshacer();
    if (!document.querySelector('dialog[open]')) html.classList.remove('bloqueo');
    foco?.focus({ preventScroll: true });
  }

  /* ── Deshacer (quitar una línea o vaciar) ── */
  let deshacer: { tipo: 'linea'; i: number; linea: Linea } | { tipo: 'todo'; lineas: Linea[] } | null = null;
  let tDeshacer = 0;
  function ofrecerDeshacer(d: NonNullable<typeof deshacer>, es: string, ing: string) {
    deshacer = d;
    ponerBi($('#pd-deshacer-texto', dlg)!, es, ing);
    barraDeshacer.hidden = false;
    barraDeshacer.classList.remove('sale');
    clearTimeout(tDeshacer);
    tDeshacer = window.setTimeout(ocultarDeshacer, 6000);
  }
  function ocultarDeshacer() {
    clearTimeout(tDeshacer);
    deshacer = null;
    if (barraDeshacer.hidden) return;
    if (reducir()) { barraDeshacer.hidden = true; return; }
    barraDeshacer.classList.add('sale');
    setTimeout(() => { if (!deshacer) { barraDeshacer.hidden = true; barraDeshacer.classList.remove('sale'); } }, 200);
  }
  $('#pd-deshacer-boton', dlg)!.addEventListener('click', () => {
    if (!deshacer) return;
    const d = deshacer;
    if (d.tipo === 'linea') lista = restaurar(lista, d.i, d.linea, Date.now());
    else for (const [i, l] of d.lineas.entries()) lista = restaurar(lista, i, l, Date.now());
    persistir();
    ocultarDeshacer();
    pintar({ animar: true });
    anunciar('Listo, lo regresamos a tu pedido.', 'Done, it’s back in your order.');
    $<HTMLElement>('#t-paso1-h', dlg)?.focus({ preventScroll: true });
  });

  async function quitarLinea(i: number) {
    const l = lista.lineas[i];
    const li = $<HTMLElement>(`[data-i="${i}"]`, ul);
    if (!l || li?.dataset.saliendo) return;
    if (li) await salir(li);
    const c = catalogo.get(l.id);
    lista = cambiar(lista, i, 0, Date.now());
    avisos = [];
    persistir();
    pintar({ animar: true });
    ofrecerDeshacer({ tipo: 'linea', i, linea: l }, `Quitaste ${c?.nombre.es ?? 'un platillo'}.`, `Removed ${c?.nombre.en ?? 'an item'}.`);
    anunciar(`${c?.nombre.es ?? 'Platillo'} quitado de tu pedido. Puedes deshacerlo.`, `${c?.nombre.en ?? 'Item'} removed from your order. You can undo it.`);
    ($<HTMLElement>(`[data-i="${Math.min(i, lista.lineas.length - 1)}"] [data-l="quitar"]`, ul) ?? $<HTMLElement>('#pd-deshacer-boton', dlg))?.focus({ preventScroll: true });
  }

  /* ── Eventos ── */
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dlg || t.closest('[data-lista-cerrar]')) { cerrar(); return; }
    const paso = t.closest<HTMLElement>('[data-ir-paso]');
    if (paso) { irPaso(Number(paso.dataset.irPaso) as Paso); return; }
    const b = t.closest<HTMLButtonElement>('[data-l]');
    if (!b) return;
    const li = b.closest<HTMLElement>('[data-i]')!;
    const i = Number(li.dataset.i);
    const l = lista.lineas[i];
    if (!l || li.dataset.saliendo) return;
    const accion = b.dataset.l;
    if (accion === 'quitar' || (accion === 'menos' && l.n <= 1)) { void quitarLinea(i); return; }
    if (accion === 'nota') {
      const abierta = notaAbierta === li.dataset.k;
      notaAbierta = abierta ? null : li.dataset.k!;
      const editor = $('.ll-editar', li)!;
      editor.hidden = abierta;
      b.setAttribute('aria-expanded', String(!abierta));
      if (!abierta) { const c = $<HTMLInputElement>('input', editor)!; c.value = l.nota ?? ''; c.focus(); }
      return;
    }
    const nuevo = accion === 'mas' ? l.n + 1 : l.n - 1;
    lista = cambiar(lista, i, nuevo, Date.now());
    avisos = [];
    persistir(); pintar();
    const out = $(`[data-i="${i}"] output`, ul);
    if (out && !reducir()) out.animate([{ transform: `translateY(${accion === 'mas' ? 8 : -8}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    $<HTMLElement>(`[data-i="${i}"] [data-l="${accion}"]`, ul)?.focus();
  });
  // Nota de una línea: se guarda al salir del campo o con Enter.
  const guardarNota = (campo: HTMLInputElement) => {
    const li = campo.closest<HTMLElement>('[data-i]');
    if (!li) return;
    const i = Number(li.dataset.i);
    if (!lista.lineas[i] || (lista.lineas[i]!.nota ?? '') === campo.value.trim()) { notaAbierta = null; pintar(); return; }
    const r = cambiarNota(lista, i, campo.value, Date.now());
    lista = r.lista;
    notaAbierta = null;
    persistir(); pintar({ animar: true });
    anunciar('Nota guardada.', 'Note saved.');
    $<HTMLElement>(`[data-i="${r.indice}"] [data-l="nota"]`, ul)?.focus({ preventScroll: true });
  };
  ul.addEventListener('keydown', (e) => {
    const t = e.target as HTMLInputElement;
    if (!t.closest('.ll-editar')) return;
    if (e.key === 'Enter') { e.preventDefault(); guardarNota(t); }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); notaAbierta = null; pintar(); }
  });
  ul.addEventListener('focusout', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.closest('.ll-editar') && !(e.relatedTarget as HTMLElement | null)?.closest?.('[data-l="nota"]')) guardarNota(t);
  });

  dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'modo') {
      actualizar({ modo: t.value as Modo });
      if (lista.modo === 'llevar') pintarHora();
      pintarFormulario(); pintarPago(); pintarErrores();
      const bloque = $<HTMLElement>(`[data-campo="${lista.modo === 'mesa' ? 'mesa' : 'nombre'}"]`, form);
      if (bloque) entrarVista(bloque, 1);
      if (lista.modo === 'domicilio') prepararMapa();
    }
    if (t.name === 'hora') {
      actualizar({ hora: t.value });
      lecturaHora({ lectura: $('#pd-hora-lectura', dlg)!, actual: lista.hora, ahora: ahoraEn(), ranuras: ranuras() });
      $$('.pd-hora-chip.vencida', dlg).forEach((v) => v.closest('.pd-hora-grupo')?.remove());
      pintarErrores();
    }
  });
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t === inp.mesa) {
      const v = Number(inp.mesa.value);
      mesa = inp.mesa.value && mesaValida(v) ? v : null;
      mesaDeQR = false;
      guardar.borrar(CLAVE_MESA_QR, true);
      if (mesa) guardar.escribir(CLAVE_MESA, String(mesa), true); else guardar.borrar(CLAVE_MESA, true);
      planoUI.marcar(mesa, false);
      pintarMesa(); pintarErrores();
      return;
    }
    if (t === inp.nombre) actualizar({ nombre: inp.nombre.value.slice(0, LIMITES.nombre) });
    else if (t === inp.direccion) actualizar({ direccion: inp.direccion.value.slice(0, LIMITES.direccion) });
    else if (t === inp.referencias) actualizar({ referencias: inp.referencias.value.slice(0, LIMITES.referencias) });
    else return;
    pintarErrores();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  // El campo enfocado queda visible sobre el teclado del teléfono.
  dlg.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input:not([type="radio"]), textarea')) setTimeout(() => t.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducir() ? 'auto' : 'smooth' }), 250);
  });

  // Pago
  const vistaPago = $('[data-vista="3"]', dlg)!;
  vistaPago.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'pago') { actualizar({ pago: t.value as FormaPago }); pintarPago(); pintarErrores(); const bloque = $<HTMLElement>(t.value === 'efectivo' ? '#pd-efectivo' : '#pd-tarjeta', dlg); if (bloque) entrarVista(bloque, 1); }
    if (t.name === 'paga') {
      if (t.value === 'otro') {
        otroAbierto = true;
        const v = Number(inp.otro.value);
        actualizar({ paga: montoValido(v) ? v : null });
        pintarPago(); pintarErrores();
        inp.otro.focus();
      } else {
        otroAbierto = false;
        actualizar({ paga: sanearPaga(t.value === 'exacto' ? 'exacto' : Number(t.value)) });
        pintarPago(); pintarErrores();
        $<HTMLInputElement>(`input[name="paga"][value="${t.value}"]`, dlg)?.focus();
      }
    }
  });
  inp.otro.addEventListener('input', () => {
    const v = Math.floor(Number(inp.otro.value));
    lista = { ...lista, paga: montoValido(v) ? v : null, t: Date.now() };
    persistir();
    const c = cambio(lista.paga, subtotal(lista, catalogo));
    const cEl = $('#pd-cambio', dlg)!;
    cEl.hidden = !c;
    if (c) { const a = document.createElement('span'); ponerBi(a, 'Tu cambio: ', 'Your change: '); const f = document.createElement('strong'); f.textContent = precio(c); cEl.replaceChildren(a, f); }
    pintarErrores();
  });

  seguir.addEventListener('click', () => { if (typeof vista === 'number' && vista < 3) irPaso((vista + 1) as Paso); });
  atras.addEventListener('click', () => { if (typeof vista === 'number' && vista > 1) irPaso((vista - 1) as Paso); });

  enviar.addEventListener('click', (e) => {
    // La hora pudo vencer con el panel abierto: se recalcula antes de validar.
    if (lista.modo === 'llevar') pintarHora(true);
    intentado.add(2); intentado.add(3);
    const { err, listo, enlace } = pintarErrores();
    if (!listo || !enlace.ok) {
      e.preventDefault();
      const p = (Object.keys(err) as Campo[]).map((c) => PASO_DE[c]).sort()[0];
      if (p && p !== 3) { vista = p; pintarPie(); pintarErrores(); mostrarVista(true, -1); }
      enfocarError((p ?? 3) as Paso);
      if (!p) errores.focus();
      return;
    }
    // El enlace abre WhatsApp en otra pestaña o en la app; aquí empieza el seguimiento.
    registrarEnvio(enlace.url);
  });

  function registrarEnvio(url: string) {
    const ahora = Date.now();
    const total = subtotal(lista, catalogo);
    const lineas = vigentes(lista, catalogo).map((l) => {
      const c = catalogo.get(l.id)!;
      const op = l.op ? c.opciones?.valores.find((v) => v.id === l.op)?.nombre : undefined;
      return { n: l.n, nombre: c.nombre, ...(op ? { op } : {}), ...(l.nota ? { nota: l.nota } : {}) };
    });
    let listo: number | undefined;
    if (lista.modo === 'llevar' && lista.hora !== 'pronto') listo = ahora + Math.max(0, minutos(lista.hora) - ahoraEn(new Date(ahora)).min) * 60_000;
    enviado = {
      v: 1, t: ahora, folio: esFolio(lista.folio) ? lista.folio : crearFolio(azar), modo: lista.modo, lineas, total, mesa: lista.modo === 'mesa' ? mesa : null,
      hora: lista.hora, ...(listo ? { listo } : {}), pago: lista.pago, paga: lista.paga, url,
    };
    guardar.escribir(CLAVE_PEDIDO, JSON.stringify(enviado));
    // El pedido ya salió: el carrito queda vacío pero se recuerdan los datos de entrega.
    lista = { ...lista, lineas: [], paga: null, folio: '', t: ahora };
    intentado.clear();
    persistir();
    // Se pinta en el siguiente cuadro para no interferir con la apertura del enlace.
    requestAnimationFrame(() => {
      vista = 'seguimiento';
      pintarSeguimientoVista();
      pintar();
      dlg.classList.remove('enviado'); void dlg.offsetWidth; dlg.classList.add('enviado');
      entrarVista($('[data-vista="seguimiento"]', dlg)!, 1);
      scroll.scrollTop = 0;
      $<HTMLElement>('#lista-titulo', dlg)?.focus({ preventScroll: true });
      anunciar(`Pedido ${enviado!.folio} enviado a WhatsApp. Te mostramos el seguimiento estimado.`, `Order ${enviado!.folio} sent to WhatsApp. Here is the estimated progress.`);
      navigator.vibrate?.(14);
    });
  }

  let tSeguimiento = 0;
  function pintarSeguimientoVista() {
    if (!enviado) return;
    pintarSeguimiento($('[data-vista="seguimiento"]', dlg)!, enviado, datos.whatsapp, idioma());
    clearInterval(tSeguimiento);
    tSeguimiento = window.setInterval(() => {
      if (!dlg.open || vista !== 'seguimiento' || !enviado) { clearInterval(tSeguimiento); return; }
      if (Date.now() - enviado.t > HORAS_PEDIDO * 3600_000) { nuevoPedido(); return; }
      pintarSeguimiento($('[data-vista="seguimiento"]', dlg)!, enviado, datos.whatsapp, idioma());
    }, 30_000);
  }
  function nuevoPedido() {
    enviado = null;
    guardar.borrar(CLAVE_PEDIDO);
    vista = 1;
    intentado.clear();
    pintar();
    mostrarVista(true, -1);
    $<HTMLElement>('#lista-titulo', dlg)?.focus({ preventScroll: true });
    anunciar('Listo para un pedido nuevo.', 'Ready for a new order.');
  }
  $('#pd-nuevo', dlg)!.addEventListener('click', nuevoPedido);
  bandaEnviado.addEventListener('click', () => { vista = 'seguimiento'; pintarSeguimientoVista(); pintar(); mostrarVista(true, 1); });

  $<HTMLButtonElement>('#lista-vaciar', dlg)!.addEventListener('click', async () => {
    const lineas = lista.lineas;
    if (!lineas.length) return;
    if (!reducir()) await Promise.all($$<HTMLElement>('.linea-lista', ul).map((li) => salir(li)));
    lista = { ...lista, lineas: [], paga: null, t: Date.now() };
    avisos = []; intentado.clear();
    persistir(); pintar();
    ofrecerDeshacer({ tipo: 'todo', lineas }, 'Vaciaste tu pedido.', 'You cleared your order.');
    anunciar('Pedido vacío. Puedes deshacerlo.', 'Order cleared. You can undo it.');
    $<HTMLElement>('#pd-deshacer-boton', dlg)?.focus({ preventScroll: true });
  });

  // Otra pestaña cambió el pedido: se toman sus platillos y se conservan los datos de entrega
  // de esta pestaña (su modalidad, su mesa del QR y lo que esté escribiendo).
  addEventListener('storage', (e) => {
    if (e.key === CLAVE_PEDIDO) { enviado = sanearPedido(leer(CLAVE_PEDIDO), Date.now()); if (!enviado && vista === 'seguimiento') vista = 1; pintar(); return; }
    if (e.key !== CLAVE) return;
    const r = sanear(leer(CLAVE), catalogo, Date.now());
    lista = { ...lista, lineas: r.lista.lineas, t: r.lista.t };
    avisos = r.avisos;
    pintar({ animar: true });
  });

  pintar();
  // Estado de la mesa del QR que viene ocupada en la demo o fuera del plano: se acepta con aviso.
  if (mesa && mesaDeQR && estadoMesa(plano, mesa) !== 'libre') pintarMesa();

  return {
    abrir, cerrar,
    pintar: () => { if (vista === 'seguimiento') pintarSeguimientoVista(); if (lista.modo === 'llevar') pintarHora(); pintar(); },
    get abierta() { return dlg.open; },
    get piezas() { return piezas(lista, catalogo); },
    get total() { return subtotal(lista, catalogo); },
    agregar(item: Agregado): ErrorAgregar | undefined {
      const r = agregarLinea(lista, item, catalogo, Date.now());
      if (r.error) {
        const [es, ing] = r.error === 'llena' ? ['Tu pedido llegó al máximo de 30 platillos distintos.', 'Your order reached the 30-item limit.']
          : r.error === 'tope' ? [`Ya tienes ${LIMITES.cantidad}, el máximo por platillo.`, `You already have ${LIMITES.cantidad}, the most per item.`]
          : r.error === 'agotado' ? ['Ese platillo está agotado.', 'That item is sold out.'] : ['No se pudo agregar.', "Couldn't add it."];
        avisar(es, ing);
        return r.error;
      }
      lista = r.lista; avisos = [];
      persistir(); pintar();
      const c = catalogo.get(item.id)!;
      const total = precio(subtotal(lista, catalogo));
      if (r.agregadas < item.n) avisar(`Se agregaron ${r.agregadas}: ${LIMITES.cantidad} es el máximo por platillo.`, `Added ${r.agregadas}: ${LIMITES.cantidad} is the most per item.`);
      else anunciar(`Agregado a tu pedido: ${r.agregadas} × ${c.nombre.es}. Total ${total}.`, `Added to your order: ${r.agregadas} × ${c.nombre.en}. Total ${total}.`);
      return undefined;
    },
    puedeAgregarDirecto(id: string) { const c = catalogo.get(id); return !!c && !c.agotado && !c.opciones; },
  };
}
