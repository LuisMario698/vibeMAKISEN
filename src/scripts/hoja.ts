// Detalle del platillo. En teléfono y tablet es una hoja que sube desde abajo (se
// arrastra); en computadora, una ventana centrada a dos columnas. Se abre
// "des-fundiéndose" desde la tarjeta (liquido.ts) y abajo tiene la barra para agregar
// a Mi lista: cantidad, sabor (si aplica) y nota.
import { etiquetasHTML } from '../lib/etiquetas';
import { precio, usd } from '../lib/precios';
import { escapar } from '../lib/texto';
import { LIMITES, type ErrorAgregar } from '../lib/pedido';
import { $, anunciar, bi, datos, enPantalla, esEscritorio, espera, html, reducir, type PlatilloCliente } from './comun';
import { cajaDe, contenido, crearLiquido, ESCALA, type Caja, type Via } from './liquido';

type Modo = 'recorte' | 'foto' | 'icono' | 'fila' | 'mosaico';
const RADIO: Record<Modo, number> = { recorte: 22, foto: 22, icono: 22, fila: 16, mosaico: 24 };
const ALTO_FOTO = 300;
const COL_FOTO = 0.46; // ancho de la columna de foto en computadora

export type Agregado = { id: string; op?: string | undefined; n: number; nota?: string | undefined };

export function crearHoja(o: {
  agregar: (item: Agregado) => ErrorAgregar | undefined;
  /** Después de agregar y cerrar (la isla recibe la gota). */
  agregado: (item: Agregado) => void;
  isla: { pildora: () => HTMLElement | null };
}) {
  const hoja = $<HTMLDialogElement>('#hoja')!;
  const panel = $('.hoja-panel', hoja)!;
  const scroller = $('.hoja-scroll', hoja)!;
  const hojaImg = $<HTMLImageElement>('#hoja-img')!;
  const cuerpo = $('#hoja-cuerpo')!;
  const barra = $('#hoja-barra')!;
  const nOut = $('#hoja-n', barra)!;
  const btnAgregar = $<HTMLButtonElement>('#hoja-agregar', barra)!;
  const totalEl = $('.total', btnAgregar)!;
  const llamar = $<HTMLAnchorElement>('#hoja-llamar', barra)!;
  const menos = $<HTMLButtonElement>('[data-menos]', barra)!;
  const mas = $<HTMLButtonElement>('[data-mas]', barra)!;
  const liquido = crearLiquido();

  let actual: PlatilloCliente | null = null;
  let origen: HTMLElement | null = null;
  let modoActual: Modo = 'icono';
  let disparador: HTMLElement | null = null;
  let ocupado = false;
  /** Cierre pedido mientras terminaba la apertura: se ejecuta al terminar. */
  let cierrePendiente = false;
  /** Evita sumar dos veces con un doble toque en «Agregar». */
  let agregando = false;
  let n = 1;
  let altoHoja = 0;

  const via = (): Via => (esEscritorio() ? 'directo' : 'columna');
  const altoMedio = () => Math.round(Math.min(innerHeight * 0.88, 780));
  const altoCompleto = () => innerHeight - 8;

  /** Caja final del panel: hoja anclada abajo o ventana centrada. */
  function cajaHoja(alto = altoMedio()): Caja {
    if (esEscritorio()) {
      const w = Math.min(innerWidth - 64, 980);
      const h = Math.min(innerHeight - 64, 680);
      hoja.style.setProperty('--ancho-hoja', `${w}px`);
      hoja.style.setProperty('--alto-hoja', `${h}px`);
      altoHoja = h;
      return { x: (innerWidth - w) / 2, y: (innerHeight - h) / 2, w, h };
    }
    const w = Math.min(innerWidth, 576);
    altoHoja = alto;
    hoja.style.setProperty('--ancho-hoja', `${w}px`);
    hoja.style.setProperty('--alto-hoja', `${alto}px`);
    return { x: (innerWidth - w) / 2, y: innerHeight - alto, w, h: alto };
  }
  /** Dónde queda la imagen principal dentro del panel. */
  function cajaImagenHoja(S: Caja, modo: Modo, img: HTMLImageElement): Caja {
    const zona: Caja = esEscritorio() ? { x: S.x, y: S.y, w: S.w * COL_FOTO, h: S.h } : { x: S.x, y: S.y, w: S.w, h: ALTO_FOTO };
    if (modo === 'foto' || modo === 'mosaico') return zona;
    if (modo === 'icono') return contenido(img, { x: zona.x + zona.w / 2 - 70, y: zona.y + zona.h / 2 - 70, w: 140, h: 140 });
    return contenido(img, { x: zona.x + zona.w * 0.1, y: zona.y + Math.max(30, (zona.h - 240) / 2), w: zona.w * 0.8, h: Math.min(zona.h - 60, esEscritorio() ? 420 : 240) });
  }

  function pintarBarra() {
    if (!actual) return;
    nOut.textContent = String(n);
    menos.disabled = n <= 1;
    mas.disabled = n >= LIMITES.cantidad;
    totalEl.textContent = precio(actual.precio * n);
    const agotado = actual.agotado;
    btnAgregar.hidden = agotado;
    menos.parentElement!.hidden = agotado;
    $('.agotado-txt', barra)!.hidden = !agotado;
    llamar.hidden = !agotado;
  }

  function llenar(p: PlatilloCliente, modo: Modo, fotoOrigen?: string) {
    const t = p.foto ? datos.fotos[p.foto] : undefined;
    const real = datos.reales[p.id];
    hojaImg.removeAttribute('srcset');
    if ((modo === 'foto' || modo === 'mosaico') && fotoOrigen) {
      hojaImg.src = fotoOrigen;
      hojaImg.className = 'hoja-foto-img absolute inset-0 h-full w-full object-cover';
    } else if (p.foto && t) {
      hojaImg.src = `/menu/${p.foto}.webp`; hojaImg.width = t[0]; hojaImg.height = t[1];
      hojaImg.className = 'hoja-foto-img relative max-h-[240px] w-auto max-w-[80%] object-contain drop-shadow-[0_26px_24px_rgb(0_0_0/0.85)] lg:max-h-[420px]';
    } else {
      hojaImg.src = datos.iconos[p.catId] ?? '/brand/isotipo.svg'; hojaImg.width = 64; hojaImg.height = 64;
      hojaImg.className = 'hoja-foto-img relative h-[140px] w-[140px] object-contain opacity-90';
    }
    const d = (k: number) => `style="--d:${k}"`;
    const conFotoGrande = modo === 'foto' || modo === 'mosaico';
    const sinFoto = !p.foto && !real && !conFotoGrande;
    const op = p.opciones;
    cuerpo.innerHTML = `
      <p ${d(0)} class="ceja mt-5">${bi(p.cat)}</p>
      <h2 ${d(1)} id="hoja-titulo" class="mt-2 text-[30px] font-semibold leading-[1.08] tracking-[-0.025em]">${bi(p.nombre)}</h2>
      <p ${d(1)} class="mt-1 text-[14px] text-humo"><span data-ver="es" lang="en">${escapar(p.nombre.en)}</span><span data-ver="en" lang="es">${escapar(p.nombre.es)}</span></p>
      <div ${d(2)} class="mt-5 flex items-end justify-between gap-4 rounded-2xl bg-noche/40 px-4 py-3 ring-1 ring-white/[0.05]">
        <p class="text-[30px] font-semibold tabular-nums leading-none ${p.agotado ? 'line-through decoration-2' : ''}">${precio(p.precio)} <span class="text-[13px] font-normal text-niebla">MXN</span></p>
        <p class="text-right text-[13px] leading-tight text-humo">${usd(p.precio, datos.tc)}<br>${bi('referencia', 'reference only')}</p>
      </div>
      ${p.agotado ? `<p ${d(3)} class="mt-4 rounded-2xl bg-hueso/[0.06] px-4 py-3 text-[15px]">${bi('Hoy está agotado. Pregunta por una alternativa.', 'Sold out today. Ask us for an alternative.')}</p>` : ''}
      ${p.descripcion ? `<p ${d(3)} class="mt-5 text-[17px] leading-relaxed text-hueso/85">${bi(p.descripcion)}</p>` : ''}
      ${p.gramos ? `<p ${d(4)} class="mt-2 text-[14px] text-humo">${bi('Porción', 'Portion')}: ${escapar(p.gramos)} g</p>` : ''}
      ${p.incluye ? `<ul ${d(4)} class="mt-4 grid gap-2">${p.incluye.map((x) => `<li class="flex items-center gap-3 text-[16px]"><span class="size-1.5 rounded-full bg-oro"></span>${bi(x)}</li>`).join('')}</ul>` : ''}
      <ul ${d(5)} class="visto mt-5 flex flex-wrap gap-2 empty:hidden">${etiquetasHTML(p)}</ul>
      ${op && !p.agotado ? `<fieldset ${d(5)} id="hoja-opciones" class="mt-6" aria-describedby="hoja-op-error">
        <legend class="text-[15px] font-semibold">${bi(op.titulo)} <span class="text-[13px] font-normal text-niebla">${bi('· elige uno', '· choose one')}</span></legend>
        <div class="mt-3 flex flex-wrap gap-2">${op.valores.map((v) => `<label class="opcion presionable"><input type="radio" name="hoja-op" value="${escapar(v.id)}" class="sr-only"><span>${bi(v.nombre)}</span></label>`).join('')}</div>
        <p id="hoja-op-error" class="mt-2 text-[14px] text-[#ffb4a3]" hidden>${bi(`Elige ${op.titulo.es.toLowerCase()} para agregar.`, `Choose a ${op.titulo.en.toLowerCase()} to add.`)}</p>
      </fieldset>` : ''}
      ${!p.agotado ? `<div ${d(6)} class="mt-6">
        <label for="hoja-nota" class="text-[15px] font-semibold">${bi('Nota para cocina', 'Note for the kitchen')} <span class="text-[13px] font-normal text-niebla">${bi('(opcional)', '(optional)')}</span></label>
        <input id="hoja-nota" type="text" maxlength="${LIMITES.nota}" autocomplete="off" enterkeyhint="done" data-ph-es="Ej. sin cebolla" data-ph-en="E.g. no onion"
          class="mt-2 h-12 w-full rounded-2xl border-0 bg-noche/50 px-4 text-[16px] text-hueso ring-1 ring-white/[0.08] placeholder:text-humo focus:ring-oro/70 focus:outline-none">
      </div>` : ''}
      ${real && !conFotoGrande ? `<figure ${d(7)} class="mt-6 overflow-hidden rounded-3xl ring-1 ring-white/[0.06]">
        <img src="${escapar(real.src)}" srcset="${escapar(real.srcset)}" sizes="(min-width: 576px) 536px, 92vw" width="${real.w}" height="${real.h}" alt="" class="block max-h-[440px] w-full object-cover" loading="lazy">
        <figcaption class="bg-noche/40 px-4 py-3 text-[13px] text-niebla">${bi('Así llega a tu mesa · foto de @makizen.puertopenasco', "How it's served · photo by @makizen.puertopenasco")}</figcaption>
      </figure>` : ''}
      ${sinFoto ? `<p ${d(7)} class="mt-5 text-[13px] text-humo">${bi('Foto del platillo próximamente.', 'Dish photo coming soon.')}</p>` : ''}`;
    const nota = $<HTMLInputElement>('#hoja-nota', cuerpo);
    if (nota) nota.placeholder = html.lang === 'en' ? nota.dataset.phEn! : nota.dataset.phEs!;
    n = 1;
    agregando = false;
    btnAgregar.disabled = false;
    pintarBarra();
  }

  function mostrarPanel() {
    // Si se giró la pantalla durante la apertura, el panel toma la forma vigente.
    hoja.dataset.forma = esEscritorio() ? 'ventana' : 'hoja';
    cajaHoja(esEscritorio() ? undefined : Math.min(altoHoja || altoMedio(), altoCompleto()));
    hoja.showModal();
    scroller.scrollTop = 0;
    html.classList.add('bloqueo');
    hoja.classList.remove('panel-listo');
    cuerpo.classList.remove('hoja-escalonada');
    void cuerpo.offsetWidth;
    hoja.classList.add('panel-listo');
    cuerpo.classList.add('hoja-escalonada');
  }

  async function abrir(id: string, boton: HTMLElement | null) {
    const p = datos.platillos.find((x) => x.id === id);
    if (!p || ocupado || hoja.open) return;
    actual = p;
    disparador = boton ?? o.isla.pildora();
    origen = boton?.closest<HTMLElement>('article.producto') ?? null;
    modoActual = (origen?.dataset.modo as Modo) ?? 'icono';
    hoja.dataset.forma = esEscritorio() ? 'ventana' : 'hoja';
    const imgOrigen = origen?.querySelector<HTMLImageElement>('img[data-foto]') ?? null;
    const fotoOrigen = (modoActual === 'foto' || modoActual === 'mosaico') && imgOrigen ? imgOrigen.currentSrc || imgOrigen.src : undefined;
    const S = cajaHoja();
    llenar(p, modoActual, fotoOrigen);

    if (!origen || !enPantalla(origen) || reducir()) {
      hoja.classList.remove('liquida');
      mostrarPanel();
      return;
    }
    ocupado = true;
    html.classList.add('bloqueo');
    hoja.classList.add('liquida', 'esperando');
    const pieza = modoActual === 'mosaico' ? (origen.parentElement as HTMLElement) : origen;
    await liquido.crecer(pieza);
    const oc = cajaDe(pieza);
    const radioFinal = esEscritorio() ? '28px' : liquido.RADIO_HOJA;
    const pasos: Promise<unknown>[] = [liquido.expandir(oc, RADIO[modoActual] * 1.06, S, via(), radioFinal)];
    if (imgOrigen) {
      const cubre = modoActual === 'foto' || modoActual === 'mosaico';
      const desde = cubre ? cajaDe(imgOrigen) : contenido(imgOrigen);
      const radioImg = esEscritorio() ? '28px 0px 0px 28px' : liquido.RADIO_HOJA;
      pasos.push(liquido.volar(imgOrigen.currentSrc || imgOrigen.src, cubre ? 'cover' : 'contain', desde, cajaImagenHoja(S, modoActual, imgOrigen),
        cubre ? [`${RADIO[modoActual]}px`, radioImg] : ['0px', '0px']));
    }
    requestAnimationFrame(() => (pieza.style.visibility = 'hidden'));
    await Promise.all(pasos);
    mostrarPanel();
    requestAnimationFrame(() => {
      hoja.classList.remove('esperando');
      liquido.limpiar();
      liquido.veloSin(false);
      pieza.getAnimations().forEach((a) => a.cancel());
      pieza.style.visibility = ''; pieza.style.zIndex = ''; pieza.classList.remove('elevada');
      ocupado = false;
      if (cierrePendiente) { cierrePendiente = false; cerrar(); }
    });
  }

  /** 'liquido': regresa fundiéndose a la tarjeta. 'rapido': baja en 260 ms (tras agregar). 'instantaneo': sin animación. */
  async function cerrar(modo: 'liquido' | 'rapido' | 'instantaneo' = 'liquido') {
    if (ocupado && hoja.open) { cierrePendiente = true; return; }
    if (!hoja.open || ocupado) return;
    const vuelve = () => { if (!document.querySelector('dialog[open]')) html.classList.remove('bloqueo'); disparador?.focus({ preventScroll: true }); };
    if (modo === 'liquido' && origen && enPantalla(origen) && !reducir()) {
      ocupado = true;
      const art = modoActual === 'mosaico' ? (origen.parentElement as HTMLElement) : origen;
      const S = cajaDe(panel);
      const imgOrigen = origen.querySelector<HTMLImageElement>('img[data-foto]');
      const cubre = modoActual === 'foto' || modoActual === 'mosaico';
      const desde = cubre ? cajaDe(hojaImg) : contenido(hojaImg);
      const src = hojaImg.currentSrc || hojaImg.src;
      art.style.zIndex = '69';
      art.style.visibility = 'hidden';
      art.animate([{ transform: `scale(${ESCALA})` }], { duration: 1, fill: 'forwards' });
      const oc = cajaDe(art);
      const radioInicio = esEscritorio() ? '28px' : liquido.RADIO_HOJA;
      hoja.close();
      hoja.classList.remove('liquida', 'panel-listo');
      const pasos: Promise<unknown>[] = [liquido.recoger(S, oc, RADIO[modoActual] * 1.06, via(), radioInicio)];
      if (imgOrigen) {
        const hasta = cubre ? cajaDe(imgOrigen) : contenido(imgOrigen);
        const radioImg = esEscritorio() ? '28px 0px 0px 28px' : liquido.RADIO_HOJA;
        pasos.push(liquido.volar(src, cubre ? 'cover' : 'contain', desde, hasta, cubre ? [radioImg, `${RADIO[modoActual] * 1.06}px`] : ['0px', '0px'], 720));
      }
      await Promise.all(pasos);
      art.style.visibility = '';
      await liquido.quitarCapa();
      liquido.quitarVuelo();
      await liquido.soltar(art);
      ocupado = false;
      vuelve();
      return;
    }
    const fin = () => { hoja.close(); hoja.classList.remove('cerrando', 'liquida', 'panel-listo'); panel.style.transform = ''; vuelve(); };
    if (modo === 'instantaneo' || reducir()) { fin(); return; }
    hoja.classList.remove('liquida');
    hoja.classList.add('cerrando');
    await espera(260);
    fin();
  }

  /* ── Barra: cantidad y agregar ── */
  menos.addEventListener('click', () => { n = Math.max(1, n - 1); pintarBarra(); });
  mas.addEventListener('click', () => { n = Math.min(LIMITES.cantidad, n + 1); pintarBarra(); });
  cuerpo.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).matches('input[name="hoja-op"]')) {
      $('#hoja-op-error', cuerpo)?.setAttribute('hidden', '');
      $('#hoja-opciones', cuerpo)?.removeAttribute('aria-invalid');
    }
  });
  btnAgregar.addEventListener('click', async () => {
    if (!actual || ocupado || agregando) return;
    const op = cuerpo.querySelector<HTMLInputElement>('input[name="hoja-op"]:checked')?.value;
    if (actual.opciones && !op) {
      const err = $('#hoja-op-error', cuerpo)!;
      err.hidden = false;
      $('#hoja-opciones', cuerpo)!.setAttribute('aria-invalid', 'true');
      anunciar(`Elige ${actual.opciones.titulo.es.toLowerCase()} para agregar.`, `Choose a ${actual.opciones.titulo.en.toLowerCase()} to add.`);
      $('#hoja-opciones', cuerpo)!.scrollIntoView({ behavior: reducir() ? 'auto' : 'smooth', block: 'center' });
      cuerpo.querySelector<HTMLInputElement>('input[name="hoja-op"]')?.focus();
      return;
    }
    const item: Agregado = { id: actual.id, n, op, nota: $<HTMLInputElement>('#hoja-nota', cuerpo)?.value };
    const error = o.agregar(item);
    if (error) return;
    agregando = true;
    btnAgregar.disabled = true;
    btnAgregar.classList.add('agregado');
    await espera(reducir() ? 0 : 160);
    btnAgregar.classList.remove('agregado');
    await cerrar('rapido');
    o.agregado(item);
  });

  // Durante la animación líquida el velo atrapa los toques (no llegan a la página de abajo);
  // un toque ahí pide cerrar en cuanto termine la apertura.
  $('#velo-hoja')!.addEventListener('click', () => { if (ocupado) cierrePendiente = true; });

  /* ── Cerrar ── */
  $('[data-cerrar]', hoja)!.addEventListener('click', () => cerrar());
  hoja.addEventListener('cancel', (ev) => { ev.preventDefault(); cerrar(); });
  hoja.addEventListener('click', (ev) => { if (ev.target === hoja) cerrar(); });

  /* ── Arrastre (solo como hoja): arriba = pantalla completa; abajo = bajar o cerrar ── */
  let y0 = 0; let dy = 0; let arrastrando = false; let altoInicial = 0;
  panel.addEventListener('pointerdown', (ev) => {
    if (esEscritorio()) return;
    const t = ev.target as HTMLElement;
    const enAsa = !!t.closest('.asa');
    if (!enAsa && (t.closest('button, a, input, textarea, select, label, fieldset, .hoja-barra') || ev.pointerType === 'mouse' || scroller.scrollTop > 0)) return;
    y0 = ev.clientY; dy = 0; arrastrando = true; altoInicial = altoHoja;
    hoja.style.transition = 'none';
  });
  addEventListener('pointermove', (ev) => {
    if (!arrastrando) return;
    dy = ev.clientY - y0;
    if (dy < 0) hoja.style.setProperty('--alto-hoja', `${Math.min(altoCompleto(), altoInicial - dy)}px`);
    else if (dy > 4) { panel.style.transition = 'none'; panel.style.transform = `translateY(${dy}px)`; }
  });
  addEventListener('pointerup', async () => {
    if (!arrastrando) return;
    arrastrando = false;
    hoja.style.transition = '';
    const animarAlto = (alto: number) => {
      hoja.animate([{ height: `${hoja.getBoundingClientRect().height}px` }, { height: `${alto}px` }], { duration: 320, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' });
      cajaHoja(alto);
    };
    if (dy < -40) { animarAlto(altoCompleto()); return; }
    if (dy < 0) { animarAlto(altoInicial); return; }
    if (dy > 110) {
      panel.style.transition = '';
      if (altoHoja > altoMedio() + 4) { panel.style.transform = ''; animarAlto(altoMedio()); return; }
      if (origen && enPantalla(origen) && !reducir()) { await cerrar(); panel.style.transform = ''; }
      else { await panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(105%)' }], { duration: 200, easing: 'cubic-bezier(0.32, 0.72, 0, 1)' }).finished; cerrar('instantaneo'); }
    } else {
      panel.style.transition = 'transform 280ms cubic-bezier(0.32, 0.72, 0, 1)';
      panel.style.transform = '';
      setTimeout(() => (panel.style.transition = ''), 300);
    }
  });

  /* ── Girar o redimensionar con la hoja abierta: recalcular su caja ── */
  let raf = 0;
  addEventListener('resize', () => {
    if (!hoja.open) return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      hoja.dataset.forma = esEscritorio() ? 'ventana' : 'hoja';
      cajaHoja(esEscritorio() ? undefined : Math.min(altoHoja, altoCompleto()));
    });
  });

  return {
    abrir, cerrar,
    get abierta() { return hoja.open; },
    idioma() {
      const nota = $<HTMLInputElement>('#hoja-nota', cuerpo);
      if (nota) nota.placeholder = html.lang === 'en' ? nota.dataset.phEn! : nota.dataset.phEs!;
    },
  };
}
