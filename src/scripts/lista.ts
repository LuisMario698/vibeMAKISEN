// Interfaz de Mi lista. La lógica (agregar, sanear, validar, mensaje) está en
// src/lib/pedido.ts; aquí solo se guarda, se pinta y se conecta con el DOM.
// Nunca se usa innerHTML con texto del cliente: las líneas salen de un <template>.
import { ahoraEn, estadoLocal, h12, ranurasHoy } from '../lib/horario';
import { leerMesa, sinMesa } from '../lib/mesa';
import {
  agregar as agregarLinea, cambiar, enlaceWhatsApp, LIMITES, listaVacia, MENSAJES_ERROR, piezas, sanear, subtotal, validar,
  type Aviso, type Campo, type Catalogo, type ErrorAgregar, type Modo,
} from '../lib/pedido';
import { precio, usd } from '../lib/precios';
import { $, $$, anunciar, datos, guardar, html, idioma, ponerBi, reducir } from './comun';
import type { Agregado } from './hoja';

const CLAVE = 'makizen-lista';
const CLAVE_MESA = 'makizen-mesa';

export function crearLista(o: { alCambiar: (piezas: number, total: number) => void }) {
  const catalogo: Catalogo = new Map(datos.platillos.map((p) => [p.id, { nombre: p.nombre, precio: p.precio, agotado: p.agotado, opciones: p.opciones }]));
  const dlg = $<HTMLDialogElement>('#lista')!;
  const panel = $('.lista-panel', dlg)!;
  const ul = $('#lista-lineas', dlg)!;
  const vacia = $('#lista-vacia', dlg)!;
  const form = $<HTMLFormElement>('#lista-form', dlg)!;
  const avisosEl = $('#lista-avisos', dlg)!;
  const resumen = $('#lista-resumen', dlg)!;
  const subEl = $('#lista-subtotal', dlg)!;
  const usdEl = $('#lista-usd', dlg)!;
  const errores = $('#lista-errores', dlg)!;
  const enviar = $<HTMLAnchorElement>('#lista-enviar', dlg)!;
  const despues = $('#lista-despues', dlg)!;
  const btnVaciar = $<HTMLButtonElement>('#lista-vaciar', dlg)!;
  const tpl = $<HTMLTemplateElement>('#tpl-linea')!;
  const inp = {
    mesa: $<HTMLInputElement>('#lista-mesa', dlg)!,
    nombre: $<HTMLInputElement>('#lista-nombre', dlg)!,
    hora: $<HTMLSelectElement>('#lista-hora', dlg)!,
    direccion: $<HTMLTextAreaElement>('#lista-direccion', dlg)!,
    referencias: $<HTMLInputElement>('#lista-referencias', dlg)!,
  };

  /* ── Mesa desde el QR: se guarda en la sesión y se quita de la URL ── */
  const deQR = leerMesa(location.search);
  if (deQR) {
    guardar.escribir(CLAVE_MESA, String(deQR), true);
    history.replaceState(history.state, '', sinMesa(location.href));
  }
  const mesaGuardada = Number(guardar.leer(CLAVE_MESA, true));
  let mesa: number | null = Number.isInteger(mesaGuardada) && mesaGuardada >= 1 && mesaGuardada <= 99 ? mesaGuardada : null;
  let mesaDeQR = mesa !== null;

  /* ── Estado guardado, saneado contra el menú vigente ── */
  const leer = () => { try { return JSON.parse(guardar.leer(CLAVE) ?? 'null'); } catch { return null; } };
  let { lista, avisos } = sanear(leer(), catalogo, Date.now());
  if (mesa && lista.lineas.length === 0) lista = { ...lista, modo: 'mesa' };
  let intentado = false;

  const persistir = () => {
    if (lista.lineas.length === 0 && !lista.nombre && !lista.direccion) guardar.borrar(CLAVE);
    else guardar.escribir(CLAVE, JSON.stringify(lista));
  };
  const entrega = () => ({ modo: lista.modo, nombre: lista.nombre, hora: lista.hora, direccion: lista.direccion, referencias: lista.referencias, mesa });

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
      const [es, en] = textoAviso(a);
      ponerBi(p, es, en);
      return p;
    }));
  }

  function pintarLineas() {
    const frag = document.createDocumentFragment();
    lista.lineas.forEach((l, i) => {
      const c = catalogo.get(l.id);
      if (!c) return;
      const li = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      li.dataset.i = String(i);
      li.classList.toggle('agotada', c.agotado);
      ponerBi($('.ll-nombre', li)!, c.nombre.es, c.nombre.en);
      const op = l.op ? c.opciones?.valores.find((v) => v.id === l.op) : undefined;
      if (op) { const e = $('.ll-op', li)!; e.hidden = false; ponerBi(e, op.nombre.es, op.nombre.en); }
      if (l.nota) { const e = $('.ll-nota', li)!; e.hidden = false; e.textContent = `“${l.nota}”`; }
      if (c.agotado) { const e = $('.ll-estado', li)!; e.hidden = false; ponerBi(e, 'Agotado hoy · no entra al pedido', 'Sold out today · not included'); }
      $('.ll-precio', li)!.textContent = precio(c.precio * l.n);
      $('output', li)!.textContent = String(l.n);
      const grupo = $('.cantidad', li)!;
      grupo.setAttribute('aria-label', `${idioma() === 'en' ? 'Quantity of' : 'Cantidad de'} ${c.nombre[idioma()]}`);
      const menos = $<HTMLButtonElement>('[data-l="menos"]', li)!;
      const quitar = l.n <= 1;
      menos.setAttribute('aria-label', quitar ? (idioma() === 'en' ? 'Remove' : 'Quitar') : (idioma() === 'en' ? 'One less' : 'Uno menos'));
      menos.innerHTML = quitar
        ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M10 11v6M14 11v6M7 7l1 12h8l1-12M9 7V5h6v2"/></svg>'
        : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 12h12"/></svg>';
      $<HTMLButtonElement>('[data-l="mas"]', li)!.disabled = l.n >= LIMITES.cantidad || c.agotado;
      frag.append(li);
    });
    ul.replaceChildren(frag);
  }

  function opcionesHora() {
    const actual = lista.hora;
    const ranuras = ranurasHoy(datos.horario, ahoraEn());
    const opts: [string, string, string][] = [['pronto', 'Lo antes posible', 'As soon as possible'], ...ranuras.map((r) => [r, h12(r), h12(r)] as [string, string, string])];
    inp.hora.replaceChildren(...opts.map(([v, es, en]) => { const op = document.createElement('option'); op.value = v; op.textContent = idioma() === 'en' ? en : es; return op; }));
    if (!opts.some(([v]) => v === actual)) lista = { ...lista, hora: 'pronto' };
    inp.hora.value = lista.hora;
  }

  function pintarFormulario() {
    $$<HTMLInputElement>('input[name="modo"]', form).forEach((r) => (r.checked = r.value === lista.modo));
    form.dataset.modo = lista.modo;
    $$('[data-campo]', form).forEach((c) => {
      const campo = c.dataset.campo!;
      const visible = campo === 'mesa' ? lista.modo === 'mesa' : campo === 'nombre' ? lista.modo !== 'mesa' : campo === 'hora' ? lista.modo === 'llevar' : lista.modo === 'domicilio';
      c.hidden = !visible;
    });
    if (document.activeElement !== inp.mesa) inp.mesa.value = mesa ? String(mesa) : '';
    if (document.activeElement !== inp.nombre) inp.nombre.value = lista.nombre;
    if (document.activeElement !== inp.direccion) inp.direccion.value = lista.direccion;
    if (document.activeElement !== inp.referencias) inp.referencias.value = lista.referencias;
    $('#ayuda-mesa', form)!.hidden = !(mesaDeQR && mesa);
    $('#lista-cerrado', form)!.hidden = estadoLocal(datos.horario, ahoraEn()).abierto;
    $$<HTMLInputElement | HTMLTextAreaElement>('[data-ph-es]', dlg).forEach((e) => (e.placeholder = html.lang === 'en' ? e.dataset.phEn! : e.dataset.phEs!));
  }

  function pintarErrores() {
    const err = validar(lista, catalogo, entrega());
    const campos = ['mesa', 'nombre', 'hora', 'direccion'] as const;
    for (const c of campos) {
      const p = $(`#err-${c}`, dlg)!;
      const mostrar = intentado && !!err[c];
      p.hidden = !mostrar;
      if (mostrar) ponerBi(p, MENSAJES_ERROR[c].es, MENSAJES_ERROR[c].en);
      inp[c].setAttribute('aria-invalid', String(mostrar));
    }
    const enlace = enlaceWhatsApp(datos.whatsapp, lista, catalogo, entrega(), idioma());
    const hayErrores = Object.keys(err).length > 0;
    const listo = !hayErrores && enlace.ok;
    enviar.setAttribute('aria-disabled', String(!listo));
    enviar.href = enlace.ok && !hayErrores ? enlace.url : '#';
    const mensajes: [string, string][] = [];
    if (intentado) {
      (Object.keys(err) as Campo[]).forEach((c) => mensajes.push([MENSAJES_ERROR[c].es, MENSAJES_ERROR[c].en]));
      if (!enlace.ok && enlace.motivo === 'larga') mensajes.push(['Tu pedido es muy largo para un solo mensaje. Divídelo en dos o llámanos.', 'Your order is too long for one message. Split it in two or call us.']);
    }
    errores.hidden = mensajes.length === 0;
    errores.replaceChildren(...mensajes.map(([es, en]) => { const p = document.createElement('p'); ponerBi(p, es, en); return p; }));
    return { err, enlace, listo };
  }

  function pintar() {
    const hay = lista.lineas.length > 0;
    vacia.hidden = hay;
    form.hidden = !hay;
    $('.lista-pie', dlg)!.hidden = !hay;
    pintarAvisos();
    pintarLineas();
    pintarFormulario();
    const total = subtotal(lista, catalogo);
    const n = piezas(lista, catalogo);
    subEl.textContent = precio(total);
    usdEl.textContent = total ? usd(total, datos.tc) : '';
    ponerBi(resumen, n === 1 ? '1 artículo' : `${n} artículos`, n === 1 ? '1 item' : `${n} items`);
    pintarErrores();
    o.alCambiar(n, total);
  }

  /* ── Abrir y cerrar ── */
  let foco: HTMLElement | null = null;
  function abrir() {
    if (dlg.open) return;
    foco = document.activeElement as HTMLElement;
    despues.hidden = true;
    opcionesHora();
    pintar();
    dlg.showModal();
    html.classList.add('bloqueo');
    $('.lista-scroll', dlg)!.scrollTop = 0;
  }
  async function cerrar() {
    if (!dlg.open) return;
    if (!reducir()) {
      dlg.classList.add('cerrando');
      await panel.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 220 }).finished;
      dlg.classList.remove('cerrando');
    }
    dlg.close();
    html.classList.remove('bloqueo');
    foco?.focus({ preventScroll: true });
  }

  /* ── Eventos ── */
  dlg.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t === dlg || t.closest('[data-lista-cerrar]')) { cerrar(); return; }
    const b = t.closest<HTMLButtonElement>('[data-l]');
    if (b) {
      const i = Number(b.closest<HTMLElement>('[data-i]')!.dataset.i);
      const l = lista.lineas[i];
      if (!l) return;
      const nuevo = b.dataset.l === 'mas' ? l.n + 1 : l.n - 1;
      lista = cambiar(lista, i, nuevo, Date.now());
      avisos = [];
      persistir(); pintar();
      if (nuevo <= 0) {
        anunciar('Platillo quitado de tu lista.', 'Item removed from your list.');
        ($<HTMLElement>(`[data-i="${Math.min(i, lista.lineas.length - 1)}"] [data-l="menos"]`, ul) ?? $<HTMLElement>('#lista-titulo', dlg))?.focus();
      } else {
        $<HTMLElement>(`[data-i="${i}"] [data-l="${b.dataset.l}"]`, ul)?.focus();
      }
    }
  });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); cerrar(); });
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'modo') { lista = { ...lista, modo: t.value as Modo, t: Date.now() }; persistir(); pintar(); }
    if (t === (inp.hora as unknown)) { lista = { ...lista, hora: inp.hora.value, t: Date.now() }; persistir(); pintarErrores(); }
  });
  form.addEventListener('input', (e) => {
    const t = e.target as HTMLElement;
    if (t === inp.mesa) { const v = Number(inp.mesa.value); mesa = Number.isInteger(v) && v >= 1 && v <= 99 ? v : null; mesaDeQR = false; if (mesa) guardar.escribir(CLAVE_MESA, String(mesa), true); }
    else if (t === inp.nombre) lista = { ...lista, nombre: inp.nombre.value.slice(0, LIMITES.nombre) };
    else if (t === inp.direccion) lista = { ...lista, direccion: inp.direccion.value.slice(0, LIMITES.direccion) };
    else if (t === inp.referencias) lista = { ...lista, referencias: inp.referencias.value.slice(0, LIMITES.referencias) };
    else return;
    lista = { ...lista, t: Date.now() };
    persistir();
    $('#ayuda-mesa', form)!.hidden = !(mesaDeQR && mesa);
    pintarErrores();
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  // El campo enfocado queda visible sobre el teclado del teléfono.
  form.addEventListener('focusin', (e) => {
    const t = e.target as HTMLElement;
    if (t.matches('input, textarea, select')) setTimeout(() => t.scrollIntoView({ block: 'center', behavior: reducir() ? 'auto' : 'smooth' }), 250);
  });

  enviar.addEventListener('click', (e) => {
    const { err, listo } = (intentado = true, pintarErrores());
    if (!listo) {
      e.preventDefault();
      const primero = (['mesa', 'nombre', 'hora', 'direccion'] as const).find((c) => err[c]);
      if (primero) inp[primero].focus();
      else errores.focus?.();
      return;
    }
    // El enlace abre WhatsApp en otra pestaña o en la app. La lista se queda por si regresa.
    setTimeout(() => { despues.hidden = false; }, 400);
  });
  $('[data-seguir]', dlg)!.addEventListener('click', () => { despues.hidden = true; });
  $('[data-vaciar-ya]', dlg)!.addEventListener('click', () => vaciar(true));

  let confirmar = 0;
  btnVaciar.addEventListener('click', () => {
    if (Date.now() < confirmar) { vaciar(false); return; }
    confirmar = Date.now() + 3000;
    ponerBi(btnVaciar, '¿Seguro? Toca otra vez', 'Sure? Tap again');
    setTimeout(() => { if (Date.now() >= confirmar) ponerBi(btnVaciar, 'Vaciar lista', 'Clear list'); }, 3100);
  });
  function vaciar(cerrarDespues: boolean) {
    const base = listaVacia(Date.now(), lista.modo);
    lista = { ...base, nombre: lista.nombre, direccion: lista.direccion, referencias: lista.referencias };
    avisos = []; intentado = false; confirmar = 0;
    ponerBi(btnVaciar, 'Vaciar lista', 'Clear list');
    despues.hidden = true;
    persistir(); pintar();
    anunciar('Lista vacía.', 'List cleared.');
    if (cerrarDespues) cerrar();
  }

  // Otra pestaña cambió la lista.
  addEventListener('storage', (e) => {
    if (e.key !== CLAVE) return;
    ({ lista, avisos } = sanear(leer(), catalogo, Date.now()));
    pintar();
  });

  pintar();

  return {
    abrir, cerrar, pintar,
    get abierta() { return dlg.open; },
    get piezas() { return piezas(lista, catalogo); },
    get total() { return subtotal(lista, catalogo); },
    agregar(item: Agregado): ErrorAgregar | undefined {
      const r = agregarLinea(lista, item, catalogo, Date.now());
      if (r.error) {
        const [es, en] = r.error === 'llena' ? ['Tu lista llegó al máximo de 30 platillos distintos.', 'Your list reached the 30-item limit.'] : r.error === 'agotado' ? ['Ese platillo está agotado.', 'That item is sold out.'] : ['No se pudo agregar.', "Couldn't add it."];
        anunciar(es, en);
        return r.error;
      }
      lista = r.lista; avisos = [];
      persistir(); pintar();
      const c = catalogo.get(item.id)!;
      anunciar(`Agregado: ${item.n} × ${c.nombre.es}. Total ${precio(subtotal(lista, catalogo))}.`, `Added: ${item.n} × ${c.nombre.en}. Total ${precio(subtotal(lista, catalogo))}.`);
      return undefined;
    },
    puedeAgregarDirecto(id: string) { const c = catalogo.get(id); return !!c && !c.agotado && !c.opciones; },
  };
}
