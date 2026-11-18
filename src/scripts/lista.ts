// Interfaz de "Mi pedido": una comanda en tres pasos (pedido, entrega, pago), envío por
// WhatsApp y vista de seguimiento. Ningún paso se desplaza: la hoja mide lo que su contenido
// y, si el pedido es largo, la comanda se resume ("y 3 más · ver todo") y la lista completa
// se abre en su propia capa, por páginas. El plano de mesas y el mapa también van en su capa.
// La lógica (agregar, sanear, validar, mensaje, pago, folio, etapas) está en src/lib/; aquí
// solo se guarda, se pinta y se conecta con el DOM. Nunca se usa innerHTML con texto del cliente.
import { ahoraEn, estadoLocal, h12, minutos, ranurasHoy } from '../lib/horario';
import { leerMesa, sinMesa } from '../lib/mesa';
import { cambio, montosSugeridos, montoValido, sanearPaga, type FormaPago } from '../lib/pago';
import {
  agregar as agregarLinea, cambiar, cambiarNota, clave, enlaceWhatsApp, LIMITES, MENSAJES_ERROR, PASO_DE, piezas, restaurar,
  sanear, subtotal, validar, vigentes, type Aviso, type Campo, type Catalogo, type ErrorAgregar, type Errores, type Linea, type Lista, type Modo,
} from '../lib/pedido';
import { estadoMesa, mesaDePlano, mesaValida, puedeElegir } from '../lib/plano';
import { precio, usd } from '../lib/precios';
import { crearFolio, esFolio, HORAS_PEDIDO, sanearPedido, type PedidoEnviado } from '../lib/seguimiento';
import { distanciaKm, lejos, redondear, type Coordenada } from '../lib/ubicacion';
import { $, $$, anunciar, avisar, datos, esEscritorio, guardar, html, idioma, ponerBi, reducir } from './comun';
import type { Agregado } from './hoja';
import { lectura as lecturaHora, pintarHoras } from './pedido/horas';
import type { Mapa } from './pedido/mapa';
import { animarLista, capturar, entrarVista, rodar, sacudir, SALIDA, salir } from './pedido/movimiento';
import { crearPlano, leerPlano } from './pedido/plano';
import { pintarSeguimiento } from './pedido/seguimiento';

const CLAVE = 'makizen-lista';
const CLAVE_PEDIDO = 'makizen-pedido';
const CLAVE_MESA = 'makizen-mesa';
const CLAVE_MESA_QR = 'makizen-mesa-qr';
const CLAVE_REABRIR = 'makizen-reabrir';
/** La modalidad la elige el cliente (o el QR de su mesa): no se da por hecha. Vive en la sesión. */
const CLAVE_MODO = 'makizen-modo-elegido';

type Paso = 1 | 2 | 3;
type Vista = Paso | 'seguimiento';
type Capa = 'plano' | 'mapa' | 'todo';
const CAMPOS_ENTREGA = ['mesa', 'nombre', 'hora', 'direccion'] as const;

const azar = () => { try { return crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32; } catch { return Math.random(); } };

export function crearLista(o: { alCambiar: (piezas: number, total: number) => void }) {
  const catalogo: Catalogo = new Map(datos.platillos.map((p) => [p.id, { nombre: p.nombre, precio: p.precio, agotado: p.agotado, opciones: p.opciones }]));
  const dlg = $<HTMLDialogElement>('#lista')!;
  const panel = $('.lista-panel', dlg)!;
  const scroll = $('.lista-scroll', dlg)!;
  const ul = $('#lista-lineas', dlg)!;
  const todoUl = $('#pd-todo-lineas', dlg)!;
  const vacia = $('#lista-vacia', dlg)!;
  const form = $<HTMLFormElement>('#lista-form', dlg)!;
  const avisosEl = $('#lista-avisos', dlg)!;
  const resumen = $('#lista-resumen', dlg)!;
  const cuentaEl = $('#pd-cuenta', dlg)!;
  const subEl = $('#lista-subtotal', dlg)!;
  const usdEl = $('#lista-usd', dlg)!;
  const errores = $('#lista-errores', dlg)!;
  const enviar = $<HTMLAnchorElement>('#lista-enviar', dlg)!;
  const seguir = $<HTMLButtonElement>('#pd-seguir', dlg)!;
  const atras = $<HTMLButtonElement>('#pd-atras', dlg)!;
  const pie = $('.lista-pie', dlg)!;
  const cabeza = $('.lista-cabeza', dlg)!;
  const tpl = $<HTMLTemplateElement>('#tpl-linea')!;
  const tplCorta = $<HTMLTemplateElement>('#tpl-linea-corta')!;
  const verTodo = $<HTMLButtonElement>('#pd-ver-todo', dlg)!;
  const totalPago = $('#pd-total-pago', dlg)!;
  const ubicResumen = $('#pd-ubic-resumen', dlg)!;
  const planoListo = $<HTMLButtonElement>('#pd-plano-listo', dlg)!;
  const bandaEnviado = $<HTMLButtonElement>('#pd-hay-enviado', dlg)!;
  const vaciaDeshacer = $('#pd-vacia-deshacer', dlg)!;
  const errModo = $('#err-modo', dlg)!;
  const horaFija = $<HTMLOutputElement>('#pd-hora-fija', dlg)!;
  const horaElegir = $('#pd-hora-elegir', dlg)!;
  const paginas = $('#pd-paginas', dlg)!;
  const inp = {
    mesa: $<HTMLInputElement>('#lista-mesa', dlg)!,
    nombre: $<HTMLInputElement>('#lista-nombre', dlg)!,
    hora: $<HTMLSelectElement>('#lista-hora', dlg)!,
    direccion: $<HTMLInputElement>('#lista-direccion', dlg)!,
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
    guardar.escribir(CLAVE_MODO, '1', true);
    history.replaceState(history.state, '', sinMesa(location.href));
  }
  const mesaGuardada = Number(guardar.leer(CLAVE_MESA, true));
  let mesa: number | null = mesaValida(mesaGuardada) ? mesaGuardada : null;
  let mesaDeQR = mesa !== null && guardar.leer(CLAVE_MESA_QR, true) === '1';

  /* ── Estado guardado, saneado contra el menú vigente ── */
  const leer = (k: string) => { try { return JSON.parse(guardar.leer(k) ?? 'null'); } catch { return null; } };
  let { lista, avisos } = sanear(leer(CLAVE), catalogo, Date.now());
  // Un QR de mesa recién escaneado manda, aunque haya un borrador "para llevar" guardado.
  if (deQR || (mesa && lista.lineas.length === 0)) lista = { ...lista, modo: 'mesa' };
  let modoElegido = guardar.leer(CLAVE_MODO, true) === '1';
  const faltaModo = () => !modoElegido;
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

  /** Errores de validación más la regla del plano (una mesa ocupada no se elige, salvo la del QR).
   *  Sin modalidad elegida, los campos de entrega aún no aplican. */
  function errores_(): Errores {
    const err = validar(lista, catalogo, entrega(), ranuras());
    if (lista.modo === 'mesa' && !err.mesa && mesa !== null && !puedeElegir(plano, mesa, mesaDeQR)) err.mesa = 'ocupada';
    if (faltaModo()) for (const c of CAMPOS_ENTREGA) delete err[c];
    return err;
  }
  const mensajeError = (c: Campo, err: Errores): [string, string] => {
    if (c === 'mesa' && err.mesa === 'ocupada') return [`La mesa ${mesa} aparece ocupada. Elige una libre en el plano.`, `Table ${mesa} shows as taken. Pick a free one on the plan.`];
    if (c === 'paga') { const t = precio(subtotal(lista, catalogo)); return [`Debe cubrir el total (${t}).`, `It must cover the total (${t}).`]; }
    // Junto al campo basta lo corto (el rótulo ya dice de qué campo se trata).
    if (c === 'nombre') return ['Falta tu nombre.', 'Your name is missing.'];
    if (c === 'direccion') return ['Falta la dirección.', 'The address is missing.'];
    if (c === 'mesa') return ['Falta el número de mesa (1 a 99).', 'Table number missing (1 to 99).'];
    return [MENSAJES_ERROR[c].es, MENSAJES_ERROR[c].en];
  };

  /* ── Pintar ── */
  function textoAviso(a: Aviso): [string, string] {
    const c = catalogo.get(a.id);
    const nom = c?.nombre ?? { es: 'Un platillo', en: 'An item' };
    if (a.tipo === 'quitado') return ['Quitamos un platillo que ya no está en el menú.', 'We removed an item that is no longer on the menu.'];
    if (a.tipo === 'agotado') return [`${nom.es} se agotó y no entra al pedido.`, `${nom.en} is sold out and won't be included.`];
    return [`${nom.es} cambió de precio: antes ${precio(a.antes)}, ahora ${precio(a.despues)}.`, `${nom.en} changed price: was ${precio(a.antes)}, now ${precio(a.despues)}.`];
  }
  /** Varios avisos se juntan en una sola línea (la comanda no debe crecer por ellos). */
  function resumenAvisos(): [string, string] {
    const n = (t: Aviso['tipo']) => avisos.filter((a) => a.tipo === t).length;
    const p = n('precio'); const g = n('agotado'); const q = n('quitado');
    const es = [p && `${p} ${p === 1 ? 'precio cambió' : 'precios cambiaron'}`, g && `${g} ${g === 1 ? 'platillo se agotó' : 'platillos se agotaron'}`, q && `${q} ${q === 1 ? 'platillo ya no está' : 'platillos ya no están'}`].filter(Boolean).join(', ');
    const ing = [p && `${p} ${p === 1 ? 'price changed' : 'prices changed'}`, g && `${g} sold out`, q && `${q} no longer on the menu`].filter(Boolean).join(', ');
    return [`Actualizamos tu pedido: ${es}.`, `We updated your order: ${ing}.`];
  }
  function pintarAvisos() {
    if (avisos.length > 1) {
      const p = document.createElement('p');
      p.className = 'aviso';
      const [es, ing] = resumenAvisos();
      ponerBi(p, es, ing);
      avisosEl.replaceChildren(p);
      return;
    }
    avisosEl.replaceChildren(...avisos.map((a) => {
      const p = document.createElement('p');
      p.className = 'aviso';
      const [es, ing] = textoAviso(a);
      ponerBi(p, es, ing);
      return p;
    }));
  }

  /* ── Deshacer: el renglón quitado queda tachado en su lugar con «Deshacer» (no tapa el pie) ── */
  let deshacer: { tipo: 'linea'; i: number; linea: Linea } | { tipo: 'todo'; lineas: Linea[] } | null = null;
  let tDeshacer = 0;
  function renglonQuitado(d: { i: number; linea: Linea }) {
    const li = document.createElement('li');
    li.className = 'linea-quitada';
    li.dataset.quitada = '1';
    const c = catalogo.get(d.linea.id);
    const s = document.createElement('s');
    ponerBi(s, `${d.linea.n} × ${c?.nombre.es ?? 'Platillo'}`, `${d.linea.n} × ${c?.nombre.en ?? 'Item'}`);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pd-enlace';
    b.dataset.deshacer = '1';
    ponerBi(b, 'Deshacer', 'Undo');
    b.setAttribute('aria-label', en() ? `Undo removing ${c?.nombre.en ?? 'item'}` : `Deshacer: regresar ${c?.nombre.es ?? 'el platillo'}`);
    li.append(s, b);
    return li;
  }

  let notaAbierta: string | null = null;
  /** Pinta las líneas en la comanda (paso 1) o en la capa "comanda completa" (compactas). */
  function pintarLineasEn(cont: HTMLElement, plantilla: HTMLTemplateElement, sufijo: string) {
    const frag = document.createDocumentFragment();
    const ing = en();
    const quitada = deshacer?.tipo === 'linea' ? deshacer : null;
    lista.lineas.forEach((l, i) => {
      if (quitada && quitada.i === i) frag.append(renglonQuitado(quitada));
      const c = catalogo.get(l.id);
      if (!c) return;
      const li = plantilla.content.firstElementChild!.cloneNode(true) as HTMLElement;
      li.dataset.i = String(i);
      li.dataset.k = clave(l);
      li.style.setProperty('--k', String(i));
      li.classList.toggle('agotada', c.agotado);
      li.classList.toggle('uno', l.n <= 1);
      ponerBi($('.ll-nombre', li)!, c.nombre.es, c.nombre.en);
      const op = l.op ? c.opciones?.valores.find((v) => v.id === l.op) : undefined;
      if (op) { const e = $('.ll-op', li)!; e.hidden = false; ponerBi(e, op.nombre.es, op.nombre.en); }
      const bNota = $<HTMLButtonElement>('[data-l="nota"]', li)!;
      if (l.nota) { const e = $('.ll-nota', li)!; e.hidden = false; e.textContent = `“${l.nota}”`; }
      ponerBi($('.ll-nota-rotulo', li)!, l.nota ? 'Editar nota' : '+ Nota', l.nota ? 'Edit note' : '+ Note');
      if (c.agotado) { const e = $('.ll-estado', li)!; e.hidden = false; if (bNota.classList.contains('lc-texto')) { bNota.disabled = true; $('.ll-nota-rotulo', li)!.hidden = true; } else bNota.hidden = true; ponerBi(e, 'Agotado hoy · no entra', 'Sold out today · not included'); }
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
      bNota.setAttribute('aria-label', `${l.nota ? (ing ? `Edit note “${l.nota}” for` : `Editar nota «${l.nota}» de`) : (ing ? 'Add a note for' : 'Agregar nota a')} ${nombre}`);
      const editor = $('.ll-editar', li)!;
      const campoNota = $<HTMLInputElement>('input', editor)!;
      campoNota.id = `ll-nota-${sufijo}${i}`;
      $('label', editor)!.setAttribute('for', campoNota.id);
      campoNota.placeholder = ing ? 'E.g. no onion…' : 'Ej. sin cebolla…';
      $<HTMLButtonElement>('[data-l="nota-listo"]', editor)!.setAttribute('aria-label', ing ? `Save note for ${nombre}` : `Guardar nota de ${nombre}`);
      if (notaAbierta === `${sufijo}${li.dataset.k}`) { editor.hidden = false; li.classList.add('editando'); campoNota.value = l.nota ?? ''; bNota.setAttribute('aria-expanded', 'true'); }
      frag.append(li);
    });
    if (quitada && quitada.i >= lista.lineas.length) frag.append(renglonQuitado(quitada));
    cont.replaceChildren(frag);
  }
  const pintarLineas = () => { pintarLineasEn(ul, tpl, ''); if (capa?.dataset.capa === 'todo') pintarTodo(); };

  /** Sin desplazamiento: si la comanda no cabe, se ocultan las últimas líneas y aparece
   *  "y N más · ver todo", que abre la comanda completa en su propia capa. */
  function ajustarLineas() {
    const items = [...ul.children] as HTMLElement[];
    for (const li of items) li.hidden = false;
    let ocultas = 0;
    const rotular = () => {
      verTodo.hidden = ocultas === 0;
      ponerBi(verTodo, `y ${ocultas} más · ver todo`, `and ${ocultas} more · see all`);
    };
    rotular();
    if (!dlg.open || vista !== 1 || dlg.classList.contains('teclado') || items.length < 2) return;
    const sobra = () => scroll.scrollHeight > scroll.clientHeight + 1;
    for (let k = items.length - 1; k >= 1 && sobra(); k--) {
      if (items[k]!.contains(document.activeElement) || items[k]!.dataset.quitada) continue;
      items[k]!.hidden = true; ocultas++;
      rotular();
    }
  }

  /* ── Capa "comanda completa": una fila por platillo; si no caben, por páginas (nunca se desplaza) ── */
  let pagina = 0;
  function pintarTodo() {
    pintarLineasEn(todoUl, tplCorta, 't');
    $('#pd-todo-total', dlg)!.textContent = precio(subtotal(lista, catalogo));
    paginar();
  }
  function paginar() {
    const items = [...todoUl.children] as HTMLElement[];
    for (const li of items) li.hidden = false;
    paginas.hidden = true;
    if (!items.length) return;
    const alto = todoUl.clientHeight;
    const fila = Math.max(44, items[0]!.offsetHeight);
    if (todoUl.scrollHeight <= alto + 1) return;
    paginas.hidden = false;
    const por = Math.max(2, Math.floor(todoUl.clientHeight / fila));
    const total = Math.ceil(items.length / por);
    pagina = Math.min(Math.max(0, pagina), total - 1);
    // La línea con foco (p. ej. su nota abierta) manda en qué página se está.
    const conFoco = items.findIndex((li) => li.contains(document.activeElement));
    if (conFoco >= 0) pagina = Math.floor(conFoco / por);
    items.forEach((li, i) => (li.hidden = Math.floor(i / por) !== pagina));
    const desde = pagina * por + 1; const hasta = Math.min(items.length, desde + por - 1);
    ponerBi($('#pd-paginas-texto', dlg)!, `${desde}–${hasta} de ${items.length}`, `${desde}–${hasta} of ${items.length}`);
    $<HTMLButtonElement>('[data-pagina="-1"]', paginas)!.disabled = pagina === 0;
    $<HTMLButtonElement>('[data-pagina="1"]', paginas)!.disabled = pagina >= total - 1;
  }
  paginas.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-pagina]');
    if (!b || b.disabled) return;
    pagina += Number(b.dataset.pagina);
    (document.activeElement as HTMLElement | null)?.blur?.();
    paginar();
    const primero = ([...todoUl.children] as HTMLElement[]).find((li) => !li.hidden);
    if (primero) entrarVista(todoUl, Number(b.dataset.pagina));
    (b.disabled ? $<HTMLButtonElement>(`[data-pagina="${-Number(b.dataset.pagina)}"]`, paginas)! : b).focus({ preventScroll: true });
  });

  /** Hora para llevar: ranuras de hoy; una hora elegida que venció se queda visible para explicar el error.
   *  Si hoy ya no hay horas, en lugar de un menú de una sola opción queda un texto fijo. */
  let horasSin: ReturnType<typeof estadoLocal>['texto'] | null = null;
  function pintarHora(conservar = false) {
    const r = ranuras();
    const ahora = ahoraEn();
    const actual = lista.hora;
    const vigente = actual === 'pronto' || r.includes(actual);
    let vencida: string | null = null;
    if (!vigente && conservar && /^\d{2}:\d{2}$/.test(actual)) vencida = actual;
    else if (!vigente) lista = { ...lista, hora: 'pronto' };
    const est = estadoLocal(datos.horario, ahora);
    horasSin = r.length ? null : est.texto;
    const lecturaEl = $('#pd-hora-lectura', dlg)!;
    pintarHoras({ cont: inp.hora, lectura: lecturaEl, ranuras: r, actual: lista.hora, ahora, vencida, sinHoras: horasSin });
    const fija = !r.length && !vencida;
    horaElegir.hidden = fija;
    horaFija.hidden = !fija;
    // Cerrado: el aviso de arriba ya lo explica, aquí solo "cuando abran".
    lecturaEl.hidden = fija && !est.abierto;
    if (fija) ponerBi(horaFija, est.abierto ? 'Lo antes posible' : 'Cuando abran', est.abierto ? 'As soon as possible' : 'When they open');
  }

  function pintarMesa() {
    planoUI.marcar(mesa, mesaDeQR);
    if (document.activeElement !== inp.mesa) inp.mesa.value = mesa ? String(mesa) : '';
    const det = $('#pd-mesa-elegida', dlg)!;
    const ayuda = $('#ayuda-mesa', dlg)!;
    const m = mesa ? mesaDePlano(plano, mesa) : undefined;
    const qr = mesaDeQR ? [' · del QR', ' · from QR'] : ['', ''];
    if (!mesa) ponerBi(det, 'Escribe el número o elígela en el plano.', 'Type the number or pick it on the plan.');
    else if (m) ponerBi(det, `${m.zona.es} · ${m.personas} personas${qr[0]}`, `${m.zona.en} · seats ${m.personas}${qr[1]}`);
    else det.replaceChildren();
    ayuda.hidden = !(mesa && !m);
    if (mesa && !m) ponerBi(ayuda, mesaDeQR ? `La mesa ${mesa} no está en el plano ilustrativo; la tomamos del QR.` : `La mesa ${mesa} no está en el plano ilustrativo; el restaurante la confirma.`,
      mesaDeQR ? `Table ${mesa} isn't on the illustrative plan; we took it from the QR.` : `Table ${mesa} isn't on the illustrative plan; the restaurant will confirm it.`);
    if (mesa) ponerBi(planoListo, `Usar mesa ${mesa}`, `Use table ${mesa}`); else ponerBi(planoListo, 'Volver', 'Back');
  }

  function pintarFormulario() {
    $$<HTMLInputElement>('input[name="modo"]', form).forEach((r) => (r.checked = modoElegido && r.value === lista.modo));
    form.dataset.modo = modoElegido ? lista.modo : '';
    $$('[data-campo]', form).forEach((c) => {
      const campo = c.dataset.campo!;
      c.hidden = !modoElegido || !(campo === 'mesa' ? lista.modo === 'mesa' : campo === 'nombre' ? lista.modo !== 'mesa' : campo === 'hora' ? lista.modo === 'llevar' : lista.modo === 'domicilio');
    });
    if (document.activeElement !== inp.nombre) inp.nombre.value = lista.nombre;
    if (document.activeElement !== inp.direccion) inp.direccion.value = lista.direccion;
    if (document.activeElement !== inp.referencias) inp.referencias.value = lista.referencias;
    pintarMesa();
    const est = estadoLocal(datos.horario, ahoraEn());
    const cerrado = $('#lista-cerrado', form)!;
    cerrado.hidden = est.abierto;
    if (!est.abierto) ponerBi(cerrado, `Cerrado ahora (${est.texto.es.replace('Cerrado · ', '')}). Puedes mandarlo y te contestan al abrir.`, `Closed now (${est.texto.en.replace('Closed · ', '')}). Send it and they'll reply when they open.`);
    pintarUbicacion();
    $$<HTMLInputElement | HTMLTextAreaElement>('[data-ph-es]', dlg).forEach((e) => (e.placeholder = en() ? e.dataset.phEn! : e.dataset.phEs!));
  }

  /* ── Paso 3: resumen de la entrega y pago ── */
  function pintarPago() {
    const total = subtotal(lista, catalogo);
    totalPago.textContent = precio(total);
    $$<HTMLInputElement>('input[name="pago"]', dlg).forEach((r) => (r.checked = r.value === lista.pago));
    const efe = $('#pd-efectivo', dlg)!; const tar = $('#pd-tarjeta', dlg)!;
    efe.hidden = lista.pago !== 'efectivo';
    tar.hidden = lista.pago !== 'tarjeta';
    const tt = { mesa: ['Te llevamos la terminal a la mesa al pedir la cuenta.', 'We bring the card terminal when you ask for the check.'],
      llevar: ['Pagas con tarjeta en caja al recoger.', 'Pay by card at the counter when you pick it up.'],
      domicilio: ['El repartidor lleva terminal y cobra al entregar.', 'The driver brings a card terminal and charges on delivery.'] }[lista.modo];
    ponerBi($('#pd-tarjeta-texto', dlg)!, tt[0]!, tt[1]!);
    const legal = lista.modo === 'domicilio'
      ? ['IVA incluido. El envío y el precio final los confirma el restaurante.', 'Tax included. The restaurant confirms the delivery fee and final price.']
      : ['IVA incluido. El precio final lo confirma el restaurante.', 'Tax included. The restaurant confirms the final price.'];
    ponerBi($('#pd-legal-pago', dlg)!, legal[0]!, legal[1]!);

    // ¿Con cuánto pagas? Exacto, montos redondos y Otro, como papeletas.
    const sugeridos = montosSugeridos(total);
    const esOtro = typeof lista.paga === 'number' && !sugeridos.includes(lista.paga);
    const tira = $('#pd-montos', dlg)!;
    const opciones: [string, string, string][] = [['exacto', 'Exacto', 'Exact'], ...sugeridos.map((m) => [String(m), precio(m), precio(m)] as [string, string, string]), ['otro', 'Otro', 'Other']];
    tira.style.setProperty('--n', String(opciones.length));
    tira.replaceChildren(...opciones.map(([v, es, ing]) => {
      const l = document.createElement('label');
      l.className = 'pd-chip';
      const r = document.createElement('input');
      r.type = 'radio'; r.name = 'paga'; r.value = v; r.className = 'sr-only';
      r.checked = v === 'otro' ? esOtro || (otroAbierto && lista.paga === null) : v === String(lista.paga);
      if (v === 'otro') r.setAttribute('aria-label', en() ? 'Other amount' : 'Otro monto');
      if (v === 'exacto') r.setAttribute('aria-label', en() ? 'Exact amount' : 'Monto exacto');
      const s = document.createElement('span'); ponerBi(s, es, ing);
      l.append(r, s);
      return l;
    }));
    const otro = $('#pd-otro', dlg)!;
    otro.hidden = !esOtro && !otroAbierto;
    if (document.activeElement !== inp.otro) inp.otro.value = typeof lista.paga === 'number' && esOtro ? String(lista.paga) : inp.otro.value;
    pintarCambio();
  }
  let otroAbierto = false;
  /** El cambio va en el mismo renglón del monto ("Otro") o bajo los billetes. */
  function pintarCambio() {
    const c = cambio(lista.paga, subtotal(lista, catalogo));
    const enOtro = !$('#pd-otro', dlg)!.hidden;
    const linea = $('#pd-cambio', dlg)!;
    const corto = $('#pd-cambio-otro', dlg)!;
    linea.hidden = !c || enOtro;
    corto.hidden = !c || !enOtro;
    if (!c) return;
    const dom = lista.modo === 'domicilio';
    const f = document.createElement('strong'); f.textContent = precio(c);
    const a = document.createElement('span');
    if (enOtro) ponerBi(a, dom ? 'Cambio ≈ ' : 'Cambio ', dom ? 'Change ≈ ' : 'Change ');
    else ponerBi(a, dom ? 'Tu cambio aprox. (sin envío): ' : 'Tu cambio: ', dom ? 'Approx. change (before delivery fee): ' : 'Your change: ');
    (enOtro ? corto : linea).replaceChildren(a, f);
  }

  function pintarResumenEntrega() {
    const t = $('#pd-entrega-titulo', dlg)!; const d = $('#pd-entrega-detalle', dlg)!;
    if (lista.modo === 'mesa') {
      const m = mesa ? mesaDePlano(plano, mesa) : undefined;
      ponerBi(t, mesa ? `En mesa · Mesa ${mesa}` : 'En mesa', mesa ? `Dine-in · Table ${mesa}` : 'Dine-in');
      ponerBi(d, m ? m.zona.es : '', m ? m.zona.en : '');
    } else if (lista.modo === 'llevar') {
      ponerBi(t, `Para llevar${lista.nombre ? ` · ${lista.nombre}` : ''}`, `Pickup${lista.nombre ? ` · ${lista.nombre}` : ''}`);
      ponerBi(d, lista.hora === 'pronto' ? 'Hoy, lo antes posible' : `Hoy a las ${h12(lista.hora, true)}`, lista.hora === 'pronto' ? 'Today, as soon as possible' : `Today at ${h12(lista.hora, true)}`);
    } else {
      ponerBi(t, `A domicilio${lista.nombre ? ` · ${lista.nombre}` : ''}`, `Delivery${lista.nombre ? ` · ${lista.nombre}` : ''}`);
      ponerBi(d, (lista.direccion || 'sin dirección') + (lista.ubic ? ' · con punto en el mapa' : ''), (lista.direccion || 'no address') + (lista.ubic ? ' · pinned on the map' : ''));
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
    // Modalidad: se pide junto a las opciones, no en el pie.
    const sinModo = intentado.has(2) && faltaModo();
    errModo.hidden = !sinModo;
    if (sinModo) ponerBi(errModo, 'Elige una: en mesa, para llevar o a domicilio.', 'Pick one: dine-in, pickup or delivery.');
    errModo.closest('fieldset')!.classList.toggle('falta', sinModo);
    // Con el error de mesa a la vista, la ayuda ("escribe el número…") sobra.
    $('#pd-mesa-elegida', dlg)!.hidden = !mesa && !$('#err-mesa', dlg)!.hidden;
    let enlace: ReturnType<typeof enlaceWhatsApp>;
    try { enlace = enlaceWhatsApp(datos.whatsapp, lista, catalogo, entrega(), idioma()); } catch { enlace = { ok: false, motivo: 'larga' }; }
    const hay = Object.keys(err).length > 0 || faltaModo();
    const listo = !hay && enlace.ok;
    enviar.href = listo && enlace.ok ? enlace.url : '#';
    // En el pie solo van los avisos sin renglón propio (los de cada campo se ven junto al campo).
    const mensajes: [string, string][] = [];
    const v = vista;
    if (typeof v === 'number' && intentado.has(v)) {
      if (err.lista && v > 1) mensajes.push(mensajeError('lista', err));
      if (v === 3 && !enlace.ok && enlace.motivo === 'larga') mensajes.push(['Tu pedido es muy largo para un solo mensaje. Divídelo en dos o llámanos.', 'Your order is too long for one message. Split it in two or call us.']);
    }
    errores.hidden = mensajes.length === 0;
    errores.replaceChildren(...mensajes.map(([es, ing]) => { const p = document.createElement('p'); ponerBi(p, es, ing); return p; }));
    if (mensajes.length && vista === 3) enviar.setAttribute('aria-describedby', 'lista-errores'); else enviar.removeAttribute('aria-describedby');
    // El resumen de la entrega (paso 3) siempre refleja lo que se va a mandar.
    pintarResumenEntrega();
    seguir.setAttribute('aria-disabled', String((vista === 1 && !hayVigentes()) || (vista === 2 && faltaModo())));
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
    $$<HTMLButtonElement>('[data-ir-paso]', dlg).forEach((b) => {
      const p = Number(b.dataset.irPaso);
      if (!b.classList.contains('pd-paso')) return;
      b.setAttribute('aria-current', p === vista ? 'step' : 'false');
      b.dataset.estado = typeof vista === 'number' && p < vista ? 'hecho' : p === vista ? 'actual' : 'pendiente';
    });
    panel.style.setProperty('--paso', String(typeof vista === 'number' ? vista - 1 : 2));
    const cuenta: [string, string] = [n === 1 ? '1 artículo' : `${n} artículos`, n === 1 ? '1 item' : `${n} items`];
    ponerBi(cuentaEl, cuenta[0], cuenta[1]);
    // En el paso 1 la comanda ya muestra cuenta y total: el resumen de arriba solo en los pasos 2 y 3.
    const total = precio(subtotal(lista, catalogo));
    if (vista === 'seguimiento' || vista === 1 || sinLineas) resumen.replaceChildren();
    else ponerBi(resumen, `${cuenta[0]} · ${total}`, `${cuenta[1]} · ${total}`);
    $('[data-titulo="pedido"]', dlg)!.hidden = vista === 'seguimiento';
    $('[data-titulo="enviado"]', dlg)!.hidden = vista !== 'seguimiento';
    bandaEnviado.hidden = !(enviado && vista === 1);
    if (enviado) $('[data-folio]', bandaEnviado)!.textContent = enviado.folio;
  }

  /** Etiquetas accesibles en el idioma activo (no "Cerrar / Close" leído de corrido). */
  function etiquetarAria() {
    $$<HTMLElement>('[data-aria-es]', dlg).forEach((e) => e.setAttribute('aria-label', (en() ? e.dataset.ariaEn : e.dataset.ariaEs) ?? ''));
  }

  let totalPrevio = -1;
  function pintar(o2: { animar?: boolean } = {}) {
    const antes = o2.animar && dlg.open ? capturar(ul) : new Map<string, number>();
    const hay = lista.lineas.length > 0;
    if (hay && !esFolio(lista.folio)) actualizar({ folio: crearFolio(azar) });
    if (!hay && typeof vista === 'number' && vista > 1) vista = 1;
    vacia.hidden = hay;
    $$('[data-con-lineas]', dlg).forEach((e) => (e.hidden = !hay));
    vaciaDeshacer.hidden = deshacer?.tipo !== 'todo';
    if (!hay && capa?.dataset.capa === 'todo') void cerrarCapa(false);
    pintarAvisos();
    pintarLineas();
    pintarFormulario();
    pintarPago();
    const total = subtotal(lista, catalogo);
    const n = piezas(lista, catalogo);
    if (dlg.open) rodar(subEl, precio(total), total >= totalPrevio); else subEl.textContent = precio(total);
    totalPrevio = total;
    usdEl.textContent = total ? usd(total, datos.tc) : '';
    etiquetarAria();
    pintarPie();
    pintarErrores();
    mostrarVista(false);
    ajustarLineas();
    animarLista(ul, antes);
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
    if (vista === 2 && modoElegido && lista.modo === 'domicilio') void prepararMapa();
  }

  /** La hoja crece desde abajo al cambiar de paso: su borde de arriba sube en lugar de saltar. */
  function crecerHoja(alto0: number) {
    if (reducir() || esEscritorio() || !dlg.open) return;
    const dy = panel.offsetHeight - alto0;
    if (dy > 2) panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 240, easing: SALIDA });
  }

  /** Primer paso con errores antes de `hasta` (para no saltarse validaciones). */
  function bloqueo(hasta: Paso): Paso | null {
    if (!hayVigentes()) return 1;
    const err = errores_();
    for (const p of [2, 3] as const) {
      if (p >= hasta) break;
      if (p === 2 && faltaModo()) return 2;
      if ((Object.keys(err) as Campo[]).some((c) => PASO_DE[c] === p)) return p;
    }
    return null;
  }

  function irPaso(p: Paso, enfocar = true) {
    if (vista === p) return;
    const alto0 = panel.offsetHeight;
    const desde = typeof vista === 'number' ? vista : 1;
    const freno = p > desde ? bloqueo(p) : null;
    if (freno !== null && freno < p) {
      intentado.add(freno);
      if (freno !== vista) { vista = freno; pintarPie(); mostrarVista(true, freno > desde ? 1 : -1); crecerHoja(alto0); }
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
    ajustarLineas();
    crecerHoja(alto0);
    if (enfocar) $<HTMLElement>(`#t-paso${p}-h`, dlg)?.focus({ preventScroll: true });
  }

  function enfocarError(p: Paso) {
    if (p === 1) { sacudir(seguir); return; }
    if (p === 2 && faltaModo()) {
      $<HTMLElement>('input[name="modo"]', form)?.focus({ preventScroll: true });
      sacudir(errModo.closest('fieldset')!);
      return;
    }
    const err = errores_();
    const c = (Object.keys(err) as Campo[]).find((k) => PASO_DE[k] === p);
    if (!c) return;
    const destino = c === 'mesa' ? inp.mesa
      : c === 'hora' ? inp.hora
      : c === 'pago' ? $<HTMLElement>('input[name="pago"]', dlg)
      : c === 'paga' ? (otroAbierto ? inp.otro : $<HTMLElement>('input[name="paga"]', dlg))
      : inp[c as 'nombre' | 'direccion'];
    destino?.focus({ preventScroll: true });
    const caja = destino?.closest<HTMLElement>('.pd-renglon, .pd-bloque, fieldset');
    if (caja) sacudir(caja);
  }

  /* ── Mapa de entrega (Leaflet bajo demanda) ── */
  let mapa: Mapa | null = null;
  let cargandoMapa = false;
  const estadoMapa = $('#pd-mapa-estado', dlg)!;
  let mensajeMapa: [string, string] | null = null;
  let mensajeCorto: [string, string] | null = null;
  /** De dónde salió el punto: tocado en el mapa o la ubicación del teléfono (con su precisión). */
  let deTelefono: number | null = null;
  const avisoMapa = (largo: [string, string] | null, corto: [string, string] | null = null) => { mensajeMapa = largo; mensajeCorto = largo ? corto ?? largo : null; pintarUbicacion(); };
  function pintarUbicacion() {
    $('#pd-quitar-pin', dlg)!.hidden = !lista.ubic;
    const km = lista.ubic && lejos(lista.ubic, centro) ? Math.round(distanciaKm(lista.ubic, centro)) : 0;
    const tel = lista.ubic && deTelefono !== null;
    const prec = tel ? ` (±${deTelefono} m)` : '';
    const [es, ing] = mensajeMapa ?? (lista.ubic
      ? [`${tel ? `Ubicación del teléfono ✓${prec}` : 'Punto fijado ✓'} El repartidor recibe el enlace del mapa${km ? ` (queda a ${km} km del restaurante: revísalo)` : ''}.`,
        `${tel ? `Phone location ✓${prec}` : 'Pin set ✓'} The driver gets the map link${km ? ` (it's ${km} km from the restaurant: please check)` : ''}.`]
      : ['Toca el mapa donde está tu puerta (luego puedes arrastrar el pin) o usa tu ubicación. Es opcional: basta con tu dirección.', 'Tap the map where your door is (then drag the pin) or use your location. It’s optional: your address is enough.']);
    ponerBi(estadoMapa, es, ing);
    const ok = !!lista.ubic && !mensajeMapa;
    estadoMapa.classList.toggle('ok', ok);
    const [ce, ci] = mensajeCorto ?? (lista.ubic
      ? [`${tel ? `Tu ubicación ✓${prec}` : 'Punto fijado ✓'}${km ? ` · a ${km} km` : ''}`, `${tel ? `Your location ✓${prec}` : 'Pin set ✓'}${km ? ` · ${km} km away` : ''}`]
      : ['Opcional', 'Optional']);
    ponerBi(ubicResumen, ce, ci);
    ubicResumen.classList.toggle('ok', ok);
    $('#pd-abrir-mapa', dlg)!.setAttribute('aria-label', lista.ubic ? (en() ? 'Adjust on the map' : 'Ajustar en el mapa') : (en() ? 'Pin it on the map' : 'Marcar en el mapa'));
    $('[data-sin-pin]', dlg)!.hidden = !!lista.ubic;
    $('[data-con-pin]', dlg)!.hidden = !lista.ubic;
  }
  // El módulo del mapa se pide una vez más si falla (red que parpadea). Si vuelve a fallar
  // suele ser una pestaña abierta desde una versión anterior del sitio: sus archivos ya no
  // existen. Entonces se ofrece recargar y el panel vuelve a abrirse en «Entrega».
  const importarMapa = () => import('./pedido/mapa').catch(() => new Promise((r) => setTimeout(r, 600)).then(() => import('./pedido/mapa')));
  function mapaNoCargo() {
    mapaEl.replaceChildren();
    const caja = document.createElement('div');
    caja.className = 'pd-mapa-cargando';
    const p = document.createElement('p');
    ponerBi(p, 'No se pudo cargar el mapa. Puedes recargarlo, usar tu ubicación o solo escribir tu dirección.', "The map couldn't load. Reload it, use your location, or just type your address.");
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pd-enlace';
    const t = document.createElement('span');
    ponerBi(t, 'Recargar mapa', 'Reload map');
    b.append(t);
    b.addEventListener('click', () => {
      guardar.escribir(CLAVE_REABRIR, '2', true);
      location.reload();
    });
    caja.append(p, b);
    mapaEl.append(caja);
    if (!lista.ubic) avisoMapa(['Sin el mapa, basta con tu dirección y señas.', 'Without the map, your address and hints are enough.'], ['Mapa no disponible', 'Map unavailable']);
  }
  async function prepararMapa() {
    if (mapa) { requestAnimationFrame(() => mapa?.ajustar()); return; }
    if (cargandoMapa) return;
    cargandoMapa = true;
    try {
      const { crearMapa } = await importarMapa();
      mapa = await crearMapa(mapaEl, {
        centro, inicial: lista.ubic,
        etiquetas: en() ? { pin: 'Delivery point', local: 'MAKIZEN (approximate)' } : { pin: 'Punto de entrega', local: 'MAKIZEN (aproximado)' },
        alMover: (c) => { deTelefono = null; actualizar({ ubic: redondear(c) }); avisoMapa(null); pintarErrores(); anunciar('Punto de entrega fijado en el mapa.', 'Delivery pin set on the map.'); },
        alFallarTeselas: () => {
          if (mapaEl.dataset.sinTeselas) return;
          mapaEl.dataset.sinTeselas = '1';
          avisoMapa(['El mapa no cargó con tu conexión. Usa tu ubicación o escribe tu dirección y señas.', "The map didn't load on your connection. Use your location or type your address and hints."], ['Mapa no disponible', 'Map unavailable']);
        },
      });
      requestAnimationFrame(() => mapa?.ajustar());
    } catch {
      mapaNoCargo();
    } finally { cargandoMapa = false; }
  }
  // "Usar mi ubicación": en el paso 2 y dentro de la capa del mapa. No se desactiva el botón
  // mientras busca (perdería el foco): se marca ocupado y se ignoran toques repetidos.
  const btnsUbic = $$<HTMLButtonElement>('[data-mi-ubicacion]', dlg);
  let buscando = false;
  const ocupado = (si: boolean) => { buscando = si; btnsUbic.forEach((b) => { if (si) { b.setAttribute('aria-busy', 'true'); b.setAttribute('aria-disabled', 'true'); } else { b.removeAttribute('aria-busy'); b.removeAttribute('aria-disabled'); } }); };
  function usarUbicacion() {
    if (buscando) return;
    if (!('geolocation' in navigator)) { avisoMapa(['Tu navegador no permite compartir la ubicación. Mueve el pin a mano.', "Your browser can't share location. Move the pin by hand."], ['Tu navegador no comparte ubicación', "Browser can't share location"]); return; }
    ocupado(true);
    avisoMapa(['Buscando tu ubicación…', 'Finding your location…'], ['Buscando tu ubicación…', 'Finding your location…']);
    navigator.geolocation.getCurrentPosition((pos) => {
      ocupado(false);
      const c = redondear({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      deTelefono = Math.max(1, Math.round(pos.coords.accuracy || 0));
      actualizar({ ubic: c });
      mapa?.mover(c, true);
      avisoMapa(null); pintarErrores();
      anunciar(`Usamos la ubicación de tu teléfono, con precisión de unos ${deTelefono} metros.`, `We used your phone's location, accurate to about ${deTelefono} meters.`);
    }, (e) => {
      ocupado(false);
      if (e.code === 1) avisoMapa(['No diste permiso de ubicación. Puedes activarlo en tu navegador o mover el pin a mano.', 'Location permission was denied. Turn it on in your browser or move the pin by hand.'], ['Sin permiso de ubicación', 'Location permission denied']);
      else if (e.code === 3) avisoMapa(['Tardó demasiado en ubicarte. Inténtalo otra vez o mueve el pin.', 'Finding you took too long. Try again or move the pin.'], ['No te ubicamos, intenta otra vez', "Couldn't find you, try again"]);
      else avisoMapa(['No pudimos ubicarte. Mueve el pin a mano o escribe señas.', "We couldn't find you. Move the pin by hand or add hints."], ['No pudimos ubicarte', "Couldn't find you"]);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  }
  btnsUbic.forEach((b) => b.addEventListener('click', usarUbicacion));
  $('#pd-quitar-pin', dlg)!.addEventListener('click', () => {
    deTelefono = null;
    actualizar({ ubic: null });
    mapa?.quitar();
    avisoMapa(null); pintarErrores();
    btnsUbic[btnsUbic.length - 1]?.focus();
  });

  /* ── Capas (comanda completa, plano de mesas y mapa): cubren el panel; el resto queda inerte ── */
  let capa: HTMLElement | null = null;
  let focoCapa: HTMLElement | null = null;
  function abrirCapa(nombre: Capa) {
    const c = $<HTMLElement>(`[data-capa="${nombre}"]`, dlg);
    if (!c || capa === c) return;
    focoCapa = document.activeElement as HTMLElement | null;
    capa = c;
    panel.classList.add('con-capa');
    c.hidden = false;
    c.classList.remove('sale');
    c.classList.add('entra');
    setTimeout(() => c.classList.remove('entra'), 260);
    for (const el of [cabeza, scroll, pie]) el.inert = true;
    if (nombre === 'mapa') { void prepararMapa(); requestAnimationFrame(() => mapa?.ajustar()); }
    if (nombre === 'plano') pintarMesa();
    if (nombre === 'todo') { pagina = 0; pintarTodo(); }
    $<HTMLElement>('.pd-capa-titulo', c)?.focus({ preventScroll: true });
  }
  async function cerrarCapa(devolver = true) {
    const c = capa;
    if (!c) return;
    capa = null;
    for (const el of [cabeza, scroll, pie]) el.inert = false;
    if (!reducir() && dlg.open) {
      c.classList.add('sale');
      await new Promise((r) => setTimeout(r, 160));
    }
    c.hidden = true;
    c.classList.remove('sale');
    if (!capa) panel.classList.remove('con-capa');
    if (c.dataset.capa === 'todo') { notaAbierta = null; pintarLineas(); ajustarLineas(); }
    const volver = focoCapa?.isConnected && !focoCapa.closest('[hidden]') ? focoCapa : (c.dataset.capa === 'todo' ? $<HTMLElement>('#t-paso1-h', dlg) : null);
    if (devolver) volver?.focus({ preventScroll: true });
  }

  /* ── Plano de mesas ── */
  const planoUI = crearPlano(planoEl, (n) => {
    mesa = n; mesaDeQR = false;
    guardar.borrar(CLAVE_MESA_QR, true);
    guardar.escribir(CLAVE_MESA, String(n), true);
    inp.mesa.value = String(n);
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
    notaAbierta = null;
    for (const c of $$<HTMLElement>('.pd-capa', dlg)) c.hidden = true;
    capa = null;
    panel.classList.remove('con-capa');
    for (const el of [cabeza, scroll, pie]) el.inert = false;
    pintarHora();
    if (vista === 'seguimiento') pintarSeguimientoVista();
    totalPrevio = subtotal(lista, catalogo);
    pintar();
    dlg.classList.add('entrando');
    setTimeout(() => dlg.classList.remove('entrando'), 900);
    dlg.showModal();
    html.classList.add('bloqueo');
    scroll.scrollTop = 0;
    // La guía (si está cargada) puede poner su línea de la primera vez antes de medir qué cabe.
    document.dispatchEvent(new CustomEvent('makizen:lista-abre', { detail: { paso: dlg.dataset.paso } }));
    ajustarLineas();
  }
  async function cerrar() {
    if (!dlg.open) return;
    if (!reducir()) {
      dlg.classList.add('cerrando');
      await panel.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 220 }).finished;
      dlg.classList.remove('cerrando');
    }
    dlg.close();
    void cerrarCapa(false);
    soltarDeshacer();
    if (!document.querySelector('dialog[open]')) html.classList.remove('bloqueo');
    foco?.focus({ preventScroll: true });
  }

  /* ── Deshacer (quitar una línea o vaciar) ── */
  function ofrecerDeshacer(d: NonNullable<typeof deshacer>) {
    deshacer = d;
    clearTimeout(tDeshacer);
    tDeshacer = window.setTimeout(() => {
      const tenia = !!document.activeElement?.closest('[data-quitada], #pd-vacia-deshacer');
      soltarDeshacer();
      pintar();
      if (tenia) (lista.lineas.length ? $<HTMLElement>('#t-paso1-h', dlg) : $<HTMLElement>('#lista-vacia .pd-boton', dlg))?.focus({ preventScroll: true });
    }, 6000);
  }
  function soltarDeshacer() { clearTimeout(tDeshacer); deshacer = null; }
  function hacerDeshacer() {
    if (!deshacer) return;
    const d = deshacer;
    soltarDeshacer();
    if (d.tipo === 'linea') lista = restaurar(lista, d.i, d.linea, Date.now());
    else for (const [i, l] of d.lineas.entries()) lista = restaurar(lista, i, l, Date.now());
    persistir();
    pintar({ animar: true });
    anunciar('Listo, lo regresamos a tu pedido.', 'Done, it’s back in your order.');
    const cont = capa?.dataset.capa === 'todo' ? todoUl : ul;
    const i = d.tipo === 'linea' ? d.i : 0;
    ($<HTMLElement>(`[data-i="${i}"] [data-l="mas"]`, cont) ?? $<HTMLElement>('#t-paso1-h', dlg))?.focus({ preventScroll: true });
  }

  async function quitarLinea(i: number, cont: HTMLElement) {
    const l = lista.lineas[i];
    const li = $<HTMLElement>(`[data-i="${i}"]`, cont);
    if (!l || li?.dataset.saliendo) return;
    if (li) await salir(li);
    const c = catalogo.get(l.id);
    lista = cambiar(lista, i, 0, Date.now());
    avisos = [];
    persistir();
    ofrecerDeshacer({ tipo: 'linea', i, linea: l });
    pintar({ animar: true });
    anunciar(`${c?.nombre.es ?? 'Platillo'} quitado de tu pedido. Puedes deshacerlo.`, `${c?.nombre.en ?? 'Item'} removed from your order. You can undo it.`);
    // El foco pasa a la línea que ocupó su lugar (o a la anterior); sin líneas, al encabezado.
    const sig = $<HTMLElement>(`[data-i="${Math.min(i, lista.lineas.length - 1)}"] [data-l="menos"]`, cont);
    (sig && !sig.closest('[hidden]') ? sig : $<HTMLElement>(capa?.dataset.capa === 'todo' ? '#t-todo' : '#t-paso1-h', dlg))?.focus({ preventScroll: true });
  }

  /* ── Notas de cada línea ── */
  function abrirNota(li: HTMLElement, cont: HTMLElement) {
    const i = Number(li.dataset.i);
    const l = lista.lineas[i];
    if (!l) return;
    const sufijo = cont === todoUl ? 't' : '';
    notaAbierta = `${sufijo}${li.dataset.k}`;
    li.classList.add('editando');
    const editor = $('.ll-editar', li)!;
    editor.hidden = false;
    $('[data-l="nota"]', li)!.setAttribute('aria-expanded', 'true');
    const campo = $<HTMLInputElement>('input', editor)!;
    campo.value = l.nota ?? '';
    campo.focus();
  }
  // Se guarda con Enter, con «Listo» o al salir del campo.
  const guardarNota = (campo: HTMLInputElement) => {
    const li = campo.closest<HTMLElement>('[data-i]');
    if (!li) return;
    const cont = li.parentElement!;
    const i = Number(li.dataset.i);
    if (!lista.lineas[i] || (lista.lineas[i]!.nota ?? '') === campo.value.trim()) {
      notaAbierta = null; pintar();
      $<HTMLElement>(`[data-i="${i}"] [data-l="nota"]`, cont)?.focus({ preventScroll: true });
      return;
    }
    const r = cambiarNota(lista, i, campo.value, Date.now());
    lista = r.lista;
    notaAbierta = null;
    persistir(); pintar({ animar: true });
    anunciar('Nota guardada.', 'Note saved.');
    $<HTMLElement>(`[data-i="${r.indice}"] [data-l="nota"]`, cont)?.focus({ preventScroll: true });
  };
  for (const cont of [ul, todoUl]) {
    cont.addEventListener('keydown', (e) => {
      const t = e.target as HTMLInputElement;
      if (!t.matches('.ll-editar input')) return;
      if (e.key === 'Enter') { e.preventDefault(); guardarNota(t); }
      if (e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation();
        const i = t.closest<HTMLElement>('[data-i]')?.dataset.i;
        notaAbierta = null; pintar();
        $<HTMLElement>(`[data-i="${i}"] [data-l="nota"]`, cont)?.focus({ preventScroll: true });
      }
    });
    cont.addEventListener('focusout', (e) => {
      const t = e.target as HTMLInputElement;
      const a = e.relatedTarget as HTMLElement | null;
      if (t.matches('.ll-editar input') && !a?.closest?.('[data-l="nota"], [data-l="nota-listo"]') && t.isConnected) guardarNota(t);
    });
  }

  /* ── Eventos ── */
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dlg || t.closest('[data-lista-cerrar]')) { cerrar(); return; }
    if (t.closest('[data-deshacer]')) { hacerDeshacer(); return; }
    const abreCapa = t.closest<HTMLElement>('[data-abrir-capa]');
    if (abreCapa) { abrirCapa(abreCapa.dataset.abrirCapa as Capa); return; }
    if (t.closest('[data-cerrar-capa]')) { void cerrarCapa(); return; }
    const paso = t.closest<HTMLElement>('[data-ir-paso]');
    if (paso) { irPaso(Number(paso.dataset.irPaso) as Paso); return; }
    const b = t.closest<HTMLButtonElement>('[data-l]');
    if (!b) return;
    const li = b.closest<HTMLElement>('[data-i]');
    const cont = li?.parentElement;
    if (!li || !cont || !li.isConnected) return;
    const i = Number(li.dataset.i);
    const l = lista.lineas[i];
    if (!l || li.dataset.saliendo) return;
    const accion = b.dataset.l;
    if (accion === 'nota-listo') { guardarNota($<HTMLInputElement>('.ll-editar input', li)!); return; }
    if (accion === 'menos' && l.n <= 1) { void quitarLinea(i, cont); return; }
    if (accion === 'nota') {
      if (li.classList.contains('editando')) { guardarNota($<HTMLInputElement>('.ll-editar input', li)!); return; }
      if (notaAbierta) { notaAbierta = null; pintar(); }
      const nuevo = $<HTMLElement>(`[data-i="${i}"]`, cont);
      if (nuevo) abrirNota(nuevo, cont);
      return;
    }
    const nuevo = accion === 'mas' ? l.n + 1 : l.n - 1;
    lista = cambiar(lista, i, nuevo, Date.now());
    avisos = [];
    persistir(); pintar();
    const out = $(`[data-i="${i}"] output`, cont);
    if (out && !reducir()) out.animate([{ transform: `translateY(${accion === 'mas' ? 8 : -8}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: SALIDA });
    $<HTMLElement>(`[data-i="${i}"] [data-l="${accion}"]`, cont)?.focus();
  });

  // Escape: primero cierra la capa; luego el panel.
  dlg.addEventListener('cancel', (e) => {
    e.preventDefault();
    if (capa) { void cerrarCapa(); return; }
    cerrar();
  });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'modo') {
      modoElegido = true;
      guardar.escribir(CLAVE_MODO, '1', true);
      const alto0 = panel.offsetHeight;
      actualizar({ modo: t.value as Modo });
      if (lista.modo === 'llevar') pintarHora();
      pintarFormulario(); pintarPago(); pintarErrores();
      const bloque = $<HTMLElement>(`[data-campo="${lista.modo === 'mesa' ? 'mesa' : 'nombre'}"]`, form);
      if (bloque) entrarVista(bloque, 1);
      crecerHoja(alto0);
      if (lista.modo === 'domicilio') prepararMapa();
    }
    if (t.name === 'hora') {
      actualizar({ hora: t.value });
      lecturaHora({ lectura: $('#pd-hora-lectura', dlg)!, actual: lista.hora, ahora: ahoraEn(), ranuras: ranuras(), sinHoras: horasSin });
      inp.hora.querySelector('option:disabled')?.remove();
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

  /* ── Teclado del teléfono ──
     En iOS (y en Android desde Chrome 108) el teclado solo encoge el «viewport visual»: el
     panel, anclado abajo, quedaría detrás del teclado con el campo y el botón tapados. Con el
     teclado abierto el panel se apoya sobre el teclado (--vv-abajo / --vv-alto) y entra en
     modo compacto (.teclado): sin pasos ni lo ya elegido, solo los campos y el botón. Si el
     teclado sí encoge la página (resizes-content), 100dvh ya se ajusta y aquí solo se compacta. */
  const vv = window.visualViewport;
  if (vv) {
    let base = 0; let anchoBase = 0;
    const campoTexto = () => !!(document.activeElement as HTMLElement | null)?.matches?.('#lista input:not([type="radio"]):not([type="checkbox"]), #lista textarea');
    const ajustarTeclado = () => {
      if (!dlg.open) return;
      // Altura de referencia sin teclado (se reinicia al girar o cambiar el ancho).
      if (vv.width !== anchoBase) { anchoBase = vv.width; base = 0; }
      if (!campoTexto()) base = Math.max(base, vv.height, innerHeight);
      else base = Math.max(base, innerHeight);
      const sinZoom = Math.abs(vv.scale - 1) < 0.05;
      const teclado = sinZoom && campoTexto() && base - vv.height > 140;
      const antes = dlg.classList.contains('teclado');
      dlg.classList.toggle('teclado', teclado);
      if (antes !== teclado) requestAnimationFrame(() => { ajustarLineas(); if (capa?.dataset.capa === 'todo') paginar(); });
      // Solo cuando el teclado tapa la página (no la encoge) se apoya el panel sobre él.
      const tapa = teclado && innerHeight - vv.height > 80;
      dlg.classList.toggle('teclado-vv', tapa);
      if (tapa) {
        dlg.style.setProperty('--vv-alto', `${Math.round(vv.height)}px`);
        dlg.style.setProperty('--vv-abajo', `${Math.max(0, Math.round(innerHeight - vv.offsetTop - vv.height))}px`);
      } else {
        dlg.style.removeProperty('--vv-alto');
        dlg.style.removeProperty('--vv-abajo');
      }
    };
    let cuadro = 0;
    const pedir = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(ajustarTeclado); };
    vv.addEventListener('resize', pedir);
    vv.addEventListener('scroll', pedir);
    dlg.addEventListener('focusin', pedir);
    dlg.addEventListener('focusout', () => setTimeout(pedir, 60));
    dlg.addEventListener('close', () => { dlg.classList.remove('teclado', 'teclado-vv'); dlg.style.removeProperty('--vv-alto'); dlg.style.removeProperty('--vv-abajo'); });
  }

  // Pago
  const vistaPago = $('[data-vista="3"]', dlg)!;
  vistaPago.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'pago') {
      const alto0 = panel.offsetHeight;
      actualizar({ pago: t.value as FormaPago }); pintarPago(); pintarErrores();
      const bloque = $<HTMLElement>(t.value === 'efectivo' ? '#pd-efectivo' : '#pd-tarjeta', dlg);
      if (bloque) entrarVista(bloque, 1);
      crecerHoja(alto0);
    }
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
    pintarCambio();
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
      const p = faltaModo() ? 2 : (Object.keys(err) as Campo[]).map((c) => PASO_DE[c]).sort()[0];
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
    persistir();
    ofrecerDeshacer({ tipo: 'todo', lineas });
    pintar();
    anunciar('Pedido vacío. Puedes deshacerlo.', 'Order cleared. You can undo it.');
    $<HTMLElement>('#pd-vacia-deshacer [data-deshacer]', dlg)?.focus({ preventScroll: true });
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

  // El panel cambia de alto (giro, barra del navegador, teclado): se recalcula cuántas líneas caben.
  if ('ResizeObserver' in window) {
    let alto = 0;
    new ResizeObserver(() => { const h = panel.clientHeight; if (h !== alto) { alto = h; requestAnimationFrame(() => { ajustarLineas(); if (capa?.dataset.capa === 'todo') paginar(); }); } }).observe(panel);
  }

  pintar();
  // Estado de la mesa del QR que viene ocupada en la demo o fuera del plano: se acepta con aviso.
  if (mesa && mesaDeQR && estadoMesa(plano, mesa) !== 'libre') pintarMesa();
  // Se recargó la página para traer el mapa: el panel vuelve a abrirse en «Entrega».
  if (guardar.leer(CLAVE_REABRIR, true) === '2') {
    guardar.borrar(CLAVE_REABRIR, true);
    if (lista.lineas.length) requestAnimationFrame(() => { abrir(); irPaso(2, false); });
  }

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
