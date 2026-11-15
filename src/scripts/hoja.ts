// Detalle del platillo. En teléfono y tablet es una hoja que sube desde abajo (se
// arrastra); en computadora, una ventana centrada a dos columnas. Se abre con un
// «revelado en mármol» desde la tarjeta (morfo.ts) y abajo tiene la barra para agregar
// a «Mi pedido»: cantidad, sabor (si aplica) y nota.
import { etiquetasHTML } from '../lib/etiquetas';
import { precio, usd } from '../lib/precios';
import { escapar } from '../lib/texto';
import { LIMITES, type ErrorAgregar } from '../lib/pedido';
import { rodillo } from '../lib/detalle';
import { $, anunciar, bi, datos, enPantalla, esEscritorio, espera, html, reducir, type PlatilloCliente } from './comun';
import { abrirBolsa, esperar, recibirBolsa, type Destino } from './bolsa';
import { aLaBolsa, anchoVista, cajaDe, chispear, crearMorfo, proporcion, radios, rectImagen, type Ajuste, type Caja, type Forma, type Radios } from './morfo';

/** Precio que entra rodando: cada dígito da una vuelta completa y se asienta, de izquierda a derecha. */
const COLUMNA = Array.from({ length: 20 }, (_, i) => `<span>${i % 10}</span>`).join('');
function precioRodante(texto: string) {
  let k = 0;
  const piezas = rodillo(texto).map((p) => (p.tipo === 'digito' ? `<span class="rd"><span class="rd-ancho">${p.v}</span><span class="rd-col" style="--v:${p.v};--k:${k++}">${COLUMNA}</span></span>` : `<span>${escapar(p.t)}</span>`)).join('');
  return `<span class="sr-only">${escapar(texto)}</span><span class="rodillo" aria-hidden="true">${piezas}</span>`;
}

type Modo = 'recorte' | 'foto' | 'icono' | 'fila' | 'mosaico';
const RADIO: Record<Modo, number> = { recorte: 22, foto: 22, icono: 22, fila: 16, mosaico: 24 };
const ALTO_FOTO = 300;
const COL_FOTO = 0.46; // ancho de la columna de foto en computadora

export type Agregado = { id: string; op?: string | undefined; n: number; nota?: string | undefined };

export function crearHoja(o: {
  agregar: (item: Agregado) => ErrorAgregar | undefined;
  /** Cuando la miniatura llega a la bolsa (o enseguida, sin animación). */
  agregado: (item: Agregado, destino: Destino | null) => void;
  isla: { pildora: () => HTMLElement | null };
  /** Bolsa visible a la que vuela el platillo (isla o barra superior). */
  bolsa: () => Destino | null;
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
  const zonaFoto = $('.hoja-foto', hoja)!;
  const sombra = $('.hoja-sombra', hoja)!;
  const brillo = $('.hoja-brillo', hoja)!;
  const chispasEl = $('.hoja-chispas', hoja)!;
  const enso = $<SVGSVGElement>('.enso', hoja)!;
  const morfo = crearMorfo();

  let actual: PlatilloCliente | null = null;
  let origen: HTMLElement | null = null;
  let modoActual: Modo = 'icono';
  let disparador: HTMLElement | null = null;
  let ocupado = false;
  /** Solo durante la apertura animada: ahí un cierre se pospone; durante un cierre se ignora. */
  let abriendo = false;
  /** Cierre pedido mientras terminaba la apertura: se ejecuta al terminar. */
  let cierrePendiente = false;
  /** Evita sumar dos veces con un doble toque en «Agregar». */
  let agregando = false;
  let n = 1;
  let altoHoja = 0;

  const forma = (): Forma => (esEscritorio() ? 'ventana' : 'hoja');
  const radiosPanel = (): Radios => (esEscritorio() ? radios(28) : [28, 28, 0, 0]);
  const radiosFoto = (): Radios => (esEscritorio() ? [28, 0, 0, 28] : [28, 28, 0, 0]);
  const cubre = (m: Modo) => m === 'foto' || m === 'mosaico';
  const altoMedio = () => Math.round(Math.min(innerHeight * 0.88, 780));
  const altoCompleto = () => innerHeight - 8;

  /** Caja final del panel: hoja anclada abajo o ventana centrada. */
  function cajaHoja(alto = altoMedio()): Caja {
    if (esEscritorio()) {
      const vw = anchoVista();
      const w = Math.min(vw - 64, 980);
      const h = Math.min(innerHeight - 64, 680);
      hoja.style.setProperty('--ancho-hoja', `${w}px`);
      hoja.style.setProperty('--alto-hoja', `${h}px`);
      altoHoja = h;
      return { x: (vw - w) / 2, y: (innerHeight - h) / 2, w, h };
    }
    const vw = anchoVista();
    const w = Math.min(vw, 576);
    altoHoja = alto;
    hoja.style.setProperty('--ancho-hoja', `${w}px`);
    hoja.style.setProperty('--alto-hoja', `${alto}px`);
    return { x: (vw - w) / 2, y: innerHeight - alto, w, h: alto };
  }
  /** Dónde queda la imagen principal dentro del panel S (antes de abrirlo). */
  function extremoHoja(S: Caja, modo: Modo): { caja: Caja; ajuste: Ajuste; radios: Radios } {
    const zona: Caja = esEscritorio() ? { x: S.x, y: S.y, w: S.w * COL_FOTO, h: S.h } : { x: S.x, y: S.y, w: S.w, h: ALTO_FOTO };
    if (cubre(modo)) return { caja: zona, ajuste: 'cover', radios: radiosFoto() };
    if (modo === 'icono') return { caja: { x: zona.x + zona.w / 2 - 70, y: zona.y + zona.h / 2 - 70, w: 140, h: 140 }, ajuste: 'contain', radios: radios(0) };
    const alto = esEscritorio() ? Math.min(zona.h - 60, 420) : 240;
    return { caja: { x: zona.x + zona.w * 0.1, y: zona.y + (zona.h - alto) / 2, w: zona.w * 0.8, h: alto }, ajuste: 'contain', radios: radios(0) };
  }
  /** La pieza de la página de la que nace (y a la que vuelve) la lámina. */
  function piezaDe(art: HTMLElement, modo: Modo) {
    if (modo === 'mosaico') return art.parentElement as HTMLElement;
    if (modo === 'fila') return art;
    return art.querySelector<HTMLElement>('.producto-marco') ?? art;
  }
  /** Imagen de la tarjeta como extremo del vuelo. */
  function extremoTarjeta(pieza: HTMLElement, img: HTMLImageElement, modo: Modo) {
    return cubre(modo)
      ? { caja: cajaDe(pieza), ajuste: 'cover' as const, radios: radios(RADIO[modo]) }
      : { caja: cajaDe(img), ajuste: 'contain' as const, radios: radios(0) };
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
        <p class="hoja-precio text-[30px] font-semibold tabular-nums leading-none ${p.agotado ? 'line-through decoration-2' : ''}">${p.agotado ? escapar(precio(p.precio)) : precioRodante(precio(p.precio))} <span class="text-[13px] font-normal text-niebla">MXN</span></p>
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
    btnAgregar.classList.remove('exito');
    limpiarAterrizaje();
    pintarBarra();
  }

  /* ── Aterrizaje: sombra que se abre, brillo que recorre el platillo y chispas de oro ── */
  function limpiarAterrizaje() {
    [sombra, brillo, brillo.firstElementChild as HTMLElement].forEach((e) => e.getAnimations().forEach((a) => a.cancel()));
    chispasEl.replaceChildren();
    sombra.style.opacity = '0';
    brillo.style.opacity = '0';
  }
  function aterrizar() {
    if (reducir() || !hoja.open) return;
    limpiarAterrizaje();
    const Z = cajaDe(zonaFoto);
    const a = proporcion(hojaImg);
    const contiene = !cubre(modoActual);
    // Rectángulo visible de la imagen dentro de la zona de la foto.
    const R = contiene ? rectImagen(cajaDe(hojaImg), a, 'contain') : Z;
    const rel = { x: R.x - Z.x, y: R.y - Z.y, w: R.w, h: R.h };
    // El brillo usa la propia imagen como máscara: solo recorre el platillo, no el mármol.
    const src = hojaImg.currentSrc || hojaImg.src;
    Object.assign(brillo.style, { left: `${rel.x}px`, top: `${rel.y}px`, width: `${rel.w}px`, height: `${rel.h}px`, opacity: '1' });
    brillo.style.setProperty('--mascara', contiene ? `url("${encodeURI(src).replace(/"/g, '%22')}")` : 'none');
    brillo.classList.toggle('a-sangre', !contiene);
    (brillo.firstElementChild as HTMLElement).animate([{ transform: 'translateX(-130%) skewX(-18deg)' }, { transform: 'translateX(230%) skewX(-18deg)' }],
      { duration: 1100, delay: contiene ? 260 : 120, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)', fill: 'both' });
    if (!contiene) return;
    // Sombra de contacto bajo el platillo: se abre como si acabara de posarse.
    const ancho = Math.min(rel.w * 0.86, 260);
    Object.assign(sombra.style, { left: `${rel.x + rel.w / 2 - ancho / 2}px`, top: `${rel.y + rel.h - 22}px`, width: `${ancho}px` });
    sombra.animate([{ transform: 'scale(0.35, 0.5)', opacity: 0 }, { transform: 'scale(1.06, 1.1)', opacity: 0.95, offset: 0.55 }, { transform: 'scale(1, 1)', opacity: 0.85 }],
      { duration: 620, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' });
    // Chispas de hoja de oro desde el anillo del ensō.
    const E = cajaDe(enso);
    if (E.w > 0) void chispear(chispasEl, E.x - Z.x + E.w / 2, E.y - Z.y + E.h / 2, (E.w / 2) * 0.86);
  }

  function mostrarPanel() {
    // Si se giró la pantalla durante la apertura, el panel toma la forma vigente.
    hoja.dataset.forma = forma();
    cajaHoja(esEscritorio() ? undefined : Math.min(altoHoja || altoMedio(), altoCompleto()));
    hoja.classList.remove('recogiendo', 'panel-listo');
    hoja.showModal();
    scroller.scrollTop = 0;
    html.classList.add('bloqueo');
    cuerpo.classList.remove('hoja-escalonada');
    void cuerpo.offsetWidth;
    hoja.classList.add('panel-listo');
    cuerpo.classList.add('hoja-escalonada');
    // Con el revelado el platillo ya llegó; con la subida simple, se espera a que asiente.
    const abierto = actual;
    window.setTimeout(() => { if (hoja.open && actual === abierto && !hoja.classList.contains('recogiendo')) aterrizar(); }, hoja.classList.contains('liquida') ? 0 : 380);
  }

  async function abrir(id: string, boton: HTMLElement | null) {
    const p = datos.platillos.find((x) => x.id === id);
    if (!p || ocupado || hoja.open) return;
    cierrePendiente = false;
    actual = p;
    disparador = boton ?? o.isla.pildora();
    origen = boton?.closest<HTMLElement>('article.producto') ?? null;
    modoActual = (origen?.dataset.modo as Modo) ?? 'icono';
    hoja.dataset.forma = forma();
    hoja.dataset.modo = modoActual;
    const imgOrigen = origen?.querySelector<HTMLImageElement>('img[data-foto]') ?? null;
    const fotoOrigen = cubre(modoActual) && imgOrigen ? imgOrigen.currentSrc || imgOrigen.src : undefined;
    const S = cajaHoja();
    llenar(p, modoActual, fotoOrigen);

    if (!origen || !enPantalla(origen) || reducir()) {
      hoja.classList.remove('liquida');
      mostrarPanel();
      return;
    }
    // Revelado: la lámina de mármol crece desde la tarjeta y la foto vuela a su lugar.
    ocupado = true;
    abriendo = true;
    html.classList.add('bloqueo');
    hoja.classList.add('liquida');
    const pieza = piezaDe(origen, modoActual);
    const dur = esEscritorio() ? 380 : 420;
    const pasos: Promise<unknown>[] = [morfo.crecer(cajaDe(pieza), radios(RADIO[modoActual]), S, radiosPanel(), forma(), dur)];
    if (imgOrigen) {
      // Los recortes aterrizan con un pequeño rebote; las fotos a sangre, sin pasarse del marco.
      pasos.push(morfo.volar(imgOrigen.currentSrc || imgOrigen.src, proporcion(imgOrigen), extremoTarjeta(pieza, imgOrigen, modoActual), extremoHoja(S, modoActual),
        dur + 20, cubre(modoActual) ? 'cubic-bezier(0.32, 0.72, 0, 1)' : 'cubic-bezier(0.34, 1.12, 0.64, 1)'));
      imgOrigen.style.visibility = 'hidden';
    }
    // Con la curva de cajón, al 85 % del tiempo la lámina y la foto ya están a ~1 px de su
    // lugar: ahí el diálogo toma el relevo (sin esperar el asentamiento invisible). La marca
    // es una animación vacía para que siga el mismo reloj que las demás.
    const marca = $('#velo-hoja')!.animate([{}, {}], { duration: Math.round(dur * 0.85) }).finished.catch(() => undefined);
    await Promise.race([Promise.all(pasos).catch(() => undefined), marca]);
    // El diálogo real ocupa el lugar de la lámina en el mismo cuadro (sin parpadeo).
    mostrarPanel();
    morfo.quitarVuelo();
    morfo.ocultar();
    morfo.veloSin(false);
    if (imgOrigen) imgOrigen.style.visibility = '';
    ocupado = false;
    abriendo = false;
    if (cierrePendiente) { cierrePendiente = false; cerrar(); }
  }

  /** 'morfo': vuelve a la tarjeta en mármol. 'rapido': baja en 260 ms (tras agregar). 'instantaneo': sin animación. */
  async function cerrar(modo: 'morfo' | 'rapido' | 'instantaneo' = 'morfo') {
    // Durante la apertura, el cierre espera a que termine; durante otro cierre, se ignora.
    if (ocupado) { if (abriendo) cierrePendiente = true; return; }
    if (!hoja.open) return;
    const vuelve = () => { cierrePendiente = false; if (!document.querySelector('dialog[open]')) html.classList.remove('bloqueo'); disparador?.focus({ preventScroll: true }); };
    if (modo === 'morfo' && origen && enPantalla(origen) && !reducir()) {
      ocupado = true;
      const pieza = piezaDe(origen, modoActual);
      const imgOrigen = origen.querySelector<HTMLImageElement>('img[data-foto]');
      // 1 · El contenido se apaga (y, ya invisible, el scroll vuelve arriba).
      hoja.classList.add('recogiendo');
      limpiarAterrizaje();
      await espera(110);
      // Si el navegador cerró el diálogo por su cuenta (Escape repetido, gesto atrás), no hay
      // panel que medir: solo se limpia.
      if (!hoja.open) {
        hoja.classList.remove('liquida', 'panel-listo', 'recogiendo');
        panel.style.transform = '';
        ocupado = false;
        vuelve();
        return;
      }
      scroller.scrollTop = 0;
      const S = cajaDe(panel);
      const rS: Radios = esEscritorio() ? radiosPanel() : [28, 28, 0, 0];
      const src = hojaImg.currentSrc || hojaImg.src;
      const a = proporcion(hojaImg);
      const desde = cubre(modoActual)
        ? { caja: cajaDe(zonaFoto), ajuste: 'cover' as const, radios: radiosFoto() }
        : { caja: cajaDe(hojaImg), ajuste: 'contain' as const, radios: radios(0) };
      const dur = esEscritorio() ? 380 : 440;
      // 2 · La lámina y la foto toman el lugar del diálogo y regresan a la tarjeta.
      const lamina = morfo.recoger(S, rS, cajaDe(pieza), radios(RADIO[modoActual]), forma(), dur);
      let vuelo: Promise<unknown> = Promise.resolve();
      if (imgOrigen) {
        imgOrigen.style.visibility = 'hidden';
        // Los recortes regresan en arco (suben y caen en su tarjeta); las fotos a sangre, directo.
        const hasta = extremoTarjeta(pieza, imgOrigen, modoActual);
        const arco = cubre(modoActual) ? 0 : Math.min(90, Math.max(36, Math.abs(hasta.caja.y - desde.caja.y) * 0.18));
        vuelo = morfo.volar(src, a, desde, hasta, dur + (arco ? 60 : 0), undefined, arco).then(() => {
          imgOrigen.style.visibility = '';
          morfo.quitarVuelo();
          // 3 · La tarjeta recibe la foto con un asentamiento leve.
          pieza.animate([{ transform: 'scale(0.97)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' });
        });
      }
      hoja.close();
      hoja.classList.remove('liquida', 'panel-listo', 'recogiendo');
      panel.style.transform = '';
      await Promise.all([lamina, vuelo]);
      ocupado = false;
      vuelve();
      return;
    }
    const fin = () => { hoja.close(); hoja.classList.remove('cerrando', 'liquida', 'panel-listo', 'recogiendo'); panel.style.transform = ''; ocupado = false; vuelve(); };
    if (modo === 'instantaneo' || reducir()) { fin(); return; }
    ocupado = true;
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
  btnAgregar.addEventListener('click', async (ev) => {
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
    // Mientras el platillo vuela, el contador de la bolsa conserva el número anterior.
    if (!reducir()) esperar();
    const error = o.agregar(item);
    if (error) { recibirBolsa(null); return; }
    agregando = true;
    navigator.vibrate?.(12);
    // 1 · El botón confirma: un relleno de oro claro nace del toque y se dibuja la palomita.
    const r = btnAgregar.getBoundingClientRect();
    const conPuntero = ev.detail > 0 && ev.clientX > 0;
    btnAgregar.style.setProperty('--tx', `${conPuntero ? ev.clientX - r.left : r.width / 2}px`);
    btnAgregar.style.setProperty('--ty', `${conPuntero ? ev.clientY - r.top : r.height / 2}px`);
    btnAgregar.classList.add('exito');
    btnAgregar.disabled = true;
    await espera(reducir() ? 0 : 380);
    // 2 · La foto del platillo cae en la bolsa mientras la hoja baja. Sale solo de la parte que
    // se ve (la hoja pudo desplazarse); si casi no se ve, sale del botón «Agregar».
    const destino = o.bolsa();
    const a = proporcion(hojaImg);
    const src = hojaImg.currentSrc || hojaImg.src;
    const base = cubre(modoActual) ? cajaDe(zonaFoto) : rectImagen(cajaDe(hojaImg), a, 'contain');
    let desde = interseccion(interseccion(base, cajaDe(scroller)), cajaDe(panel));
    if (desde.w < 24 || desde.h < 24) { const b = cajaDe(btnAgregar); desde = { x: b.x + 12, y: b.y + b.h / 2 - 20, w: 40, h: 40 }; }
    const lanzar = () => (destino && !reducir() ? aLaBolsa(src, a, desde, destino.caja, cubre(modoActual), () => abrirBolsa(destino.el)) : Promise.resolve());
    // Con popover la miniatura vuela encima de la hoja que baja; sin popover quedaría tapada
    // por el diálogo (capa superior), así que primero se cierra y luego vuela.
    const conPopover = typeof HTMLElement.prototype.showPopover === 'function';
    let vuelo: Promise<void> = Promise.resolve();
    if (conPopover) vuelo = lanzar();
    await cerrar('rapido');
    if (!conPopover) vuelo = lanzar();
    await vuelo;
    // 3 · La bolsa recibe el platillo (cierra, rebota, el contador rueda).
    o.agregado(item, destino);
  });

  /* ── Toque en una tarjeta: un destello de oro la cruza al presionarla ── */
  document.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || reducir()) return;
    const t = ev.target as HTMLElement;
    if (t.closest('[data-agregar]')) return;
    const art = t.closest<HTMLElement>('article.producto');
    if (!art) return;
    const pieza = art.dataset.modo === 'mosaico' ? art.parentElement : art.querySelector<HTMLElement>('.producto-marco');
    if (!pieza) return;
    pieza.classList.remove('destello');
    void pieza.offsetWidth;
    pieza.classList.add('destello');
    window.setTimeout(() => pieza.classList.remove('destello'), 800);
  }, { passive: true });

  const interseccion = (a: Caja, b: Caja): Caja => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    return { x, y, w: Math.max(0, Math.min(a.x + a.w, b.x + b.w) - x), h: Math.max(0, Math.min(a.y + a.h, b.y + b.h) - y) };
  };

  // Durante la transición el velo atrapa los toques (no llegan a la página de abajo);
  // un toque ahí pide cerrar en cuanto termine la apertura.
  $('#velo-hoja')!.addEventListener('click', () => { if (abriendo) cierrePendiente = true; });

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
