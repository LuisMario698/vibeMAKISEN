// Barra flotante del menú (la «isla»): tres controles separados, cada uno abre lo suyo.
//   · Sección actual (número, nombre, avance) → selector de categorías. Deslizarla cambia a la vecina.
//   · Buscar → búsqueda con el teclado listo y filtros rápidos.
//   · Mi pedido → panel del pedido (lista.ts). También es el destino del vuelo al agregar (bolsa.ts).
// Rendimiento: nada de filtros SVG ni de animar left/width/height. Aparecer, abrir y cerrar son
// transiciones CSS de transform/opacity (src/styles/isla.css) que corren en el compositor, así
// que no se traban aunque el hilo principal esté ocupado pintando la sección a la que se salta.

import { normalizar } from '../lib/texto';
import { etiquetaPedido } from '../lib/detalle';
import { ponerContador } from './bolsa';
import { miniRecorte } from './comun';

type Txt = { es: string; en: string };
type Cat = { id: string; nombre: Txt };
type Resultado = {
  id: string; nombre: Txt; cat: Txt; precio: string; foto?: string | undefined; icono: string; texto: string;
  favorito: boolean; picante: number; crudo: boolean; comida: boolean; agotado: boolean;
};
type Filtro = 'favorito' | 'sinPicante' | 'cocido';
type Estado = 'oculta' | 'pildora' | 'abierta';
type Panel = 'cats' | 'busca';

/** Texto bilingüe como nodos (sin innerHTML). */
function ponerBi(el: Element, t: Txt) {
  const s = (lang: string, txt: string) => { const n = document.createElement('span'); n.lang = lang; n.textContent = txt; return n; };
  el.replaceChildren(s('es', t.es), s('en', t.en));
}
function nodo<K extends keyof HTMLElementTagNameMap>(tag: K, clase: string, hijos: (Node | string)[] = []) {
  const n = document.createElement(tag);
  if (clase) n.className = clase;
  n.append(...hijos);
  return n;
}

export function crearIsla(o: {
  cats: Cat[];
  platillos: Resultado[];
  ir: (id: string) => void;
  abrir: (id: string) => void;
  abrirLista: () => void;
  reducir: () => boolean;
}) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
  const html = document.documentElement;
  const isla = $('#isla');
  const velo = $('#isla-velo');
  const barra = $('.isla-barra');
  const pildora = $<HTMLButtonElement>('.isla-pildora');
  const lupa = $<HTMLButtonElement>('.isla-lupa');
  const btnLista = $<HTMLButtonElement>('.isla-lista');
  const contador = $('.contador', btnLista);
  const num = $('.num', pildora);
  const texto = $('.isla-texto', pildora);
  const actual = $('.actual', pildora);
  const avance = $('.avance', pildora);
  const paneles: Record<Panel, HTMLElement> = { cats: $('#isla-panel'), busca: $('#isla-busca') };
  const input = $<HTMLInputElement>('#buscar');
  const resultados = $('.isla-resultados');
  const vacio = $('.isla-vacio');
  const pista = $('.isla-pista');
  const estadoBusqueda = $('#isla-estado');
  const botonesIr = [...document.querySelectorAll<HTMLElement>('[data-ir]')];
  const riel = document.querySelector<HTMLElement>('.riel');
  const escritorio = matchMedia('(min-width: 64rem)');

  let estado: Estado = 'oculta';
  let abierto: Panel | null = null;
  let idx = -1;
  let piezas = 0;
  let totalTxt = '';
  const filtros = new Set<Filtro>();
  const es = () => html.lang !== 'en';
  /** Cuánto tarda la barra en terminar de subir (la bolsa es el último control, --k: 2). */
  const MS_APARECE = 460;
  let tLista = 0;

  const controles = (si: boolean) => { pildora.inert = lupa.inert = btnLista.inert = !si; };

  /* ── Miniaturas del selector: se piden en un momento libre tras aparecer la barra ── */
  let precargado = false;
  function precargar() {
    if (precargado) return;
    precargado = true;
    const pedir = () => paneles.cats.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    if ('requestIdleCallback' in window) requestIdleCallback(pedir, { timeout: 2500 }); else setTimeout(pedir, 1200);
  }

  /* ── Aparecer / ocultar: los tres controles suben escalonados (CSS) ── */
  function mostrar(si: boolean) {
    if (si && estado === 'oculta') {
      estado = 'pildora';
      isla.dataset.estado = 'pildora';
      controles(true);
      if (!o.reducir()) tLista = Math.max(tLista, performance.now() + MS_APARECE);
      precargar();
    } else if (!si && estado === 'pildora') {
      estado = 'oculta';
      isla.dataset.estado = 'oculta';
      controles(false);
    }
  }

  /* ── Sección actual: número, nombre (rueda en la dirección del cambio) y avance ── */
  let rueda: Animation | null = null;
  function actualizar(nuevo: number, dir = 1) {
    if (nuevo === idx || nuevo < 0 || nuevo >= o.cats.length) return;
    const antes = idx;
    idx = nuevo;
    const c = o.cats[idx]!;
    ponerBi(actual, c.nombre);
    num.textContent = String(idx + 1).padStart(2, '0');
    avance.style.transform = `scaleX(${(idx + 1) / o.cats.length})`;
    for (const b of botonesIr) {
      const si = b.dataset.ir === c.id;
      if ((b.getAttribute('aria-current') === 'true') !== si) b.setAttribute('aria-current', String(si));
    }
    seguirEnRiel(c.id);
    if (antes < 0 || estado === 'oculta' || o.reducir()) return;
    rueda?.cancel();
    rueda = actual.animate(
      [{ transform: `translateY(${dir * 60}%)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 280, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  }
  /** En computadora, el riel lateral mantiene a la vista la categoría activa (si no cabe completo). */
  function seguirEnRiel(id: string) {
    if (!riel || riel.scrollHeight <= riel.clientHeight + 4) return;
    const b = riel.querySelector<HTMLElement>(`[data-ir="${CSS.escape(id)}"]`);
    if (!b) return;
    const y = b.offsetTop;
    if (y < riel.scrollTop + 48 || y + b.offsetHeight > riel.scrollTop + riel.clientHeight - 48) {
      riel.scrollTo({ top: y - riel.clientHeight / 2, behavior: o.reducir() ? 'auto' : 'smooth' });
    }
  }

  /* ── Abrir y cerrar paneles: hoja que sube (teléfono) o popover sobre la barra (computadora) ── */
  let foco: HTMLElement | null = null;
  function primerFoco(p: Panel) {
    if (p === 'busca') return input;
    return paneles.cats.querySelector<HTMLElement>('[data-ir][aria-current="true"]') ?? paneles.cats.querySelector<HTMLElement>('[data-ir]')!;
  }
  function abrir(conBusqueda = false) {
    const quiere: Panel = conBusqueda ? 'busca' : 'cats';
    if (abierto === quiere) return;
    if (estado === 'oculta') mostrar(true);
    if (abierto) cerrarPanel(abierto);
    else foco = document.activeElement as HTMLElement | null;
    abierto = quiere;
    estado = 'abierta';
    isla.dataset.estado = 'abierta';
    isla.dataset.panel = quiere;
    const p = paneles[quiere];
    if (escritorio.matches) {
      // El popover crece desde su botón (una lectura de layout al abrir, no por cuadro).
      const b = (quiere === 'cats' ? pildora : lupa).getBoundingClientRect();
      const r = p.getBoundingClientRect();
      p.style.setProperty('--ox', `${Math.round(b.left + b.width / 2 - r.left)}px`);
    }
    p.inert = false;
    p.classList.add('on');
    velo.classList.add('on');
    html.classList.add('isla-abierta');
    pildora.setAttribute('aria-expanded', String(quiere === 'cats'));
    lupa.setAttribute('aria-expanded', String(quiere === 'busca'));
    // En el teléfono la hoja cubre la barra: fuera del orden de Tab mientras está abierta.
    barra.inert = !escritorio.matches;
    // Foco en el mismo toque (en iPhone el teclado solo sale si el foco llega dentro del gesto).
    primerFoco(quiere).focus({ preventScroll: true });
    if (quiere === 'busca') teclado();
  }
  function cerrarPanel(p: Panel) {
    const el = paneles[p];
    el.classList.remove('on');
    el.inert = true;
    el.style.translate = '';
    el.style.maxHeight = '';
  }
  function cerrar(devolverFoco = true) {
    if (estado !== 'abierta' || !abierto) return;
    cerrarPanel(abierto);
    abierto = null;
    delete isla.dataset.panel;
    velo.classList.remove('on');
    html.classList.remove('isla-abierta');
    pildora.setAttribute('aria-expanded', 'false');
    lupa.setAttribute('aria-expanded', 'false');
    barra.inert = false;
    estado = 'pildora';
    isla.dataset.estado = 'pildora';
    controles(true);
    if (devolverFoco) (foco && foco.isConnected && !foco.closest('[inert]') ? foco : pildora).focus({ preventScroll: true });
  }

  // Teclado del teléfono: la hoja de búsqueda sube con él y se ajusta al alto visible.
  const vv = window.visualViewport;
  function teclado() {
    const p = paneles.busca;
    if (abierto !== 'busca' || escritorio.matches || !vv) { p.style.translate = ''; p.style.maxHeight = ''; return; }
    const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
    p.style.translate = kb > 40 ? `0 ${-Math.round(kb)}px` : '';
    p.style.maxHeight = kb > 40 ? `${Math.round(vv.height - 16)}px` : '';
  }
  vv?.addEventListener('resize', teclado);

  /* ── Búsqueda y filtros rápidos: las filas se crean una vez y luego solo se muestran/ocultan ── */
  let filas: { p: Resultado; li: HTMLLIElement }[] | null = null;
  function crearFilas() {
    filas = o.platillos.map((p) => {
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.loading = 'lazy';
      if (p.foto) { img.src = miniRecorte(p.foto); img.width = 40; img.height = 40; } else { img.src = p.icono; img.width = 30; img.height = 30; img.className = 'icono'; }
      const nombre = nodo('span', 'isla-res-nombre'); ponerBi(nombre, p.nombre);
      const cat = nodo('span', 'isla-res-cat'); ponerBi(cat, p.cat);
      const b = nodo('button', `isla-res presionable${p.agotado ? ' agotado' : ''}`, [
        nodo('span', 'miniatura', [img]),
        nodo('span', 'min-w-0 flex-1 text-left', [nombre, cat]),
        nodo('span', 'isla-res-precio tabular-nums', [p.precio]),
      ]);
      b.type = 'button';
      b.dataset.platillo = p.id;
      const li = nodo('li', '', [b]);
      li.hidden = true;
      return { p, li };
    });
    resultados.replaceChildren(...filas.map((f) => f.li));
  }
  function buscar() {
    const q = normalizar(input.value);
    const nada = !q && filtros.size === 0;
    pista.hidden = !nada;
    if (nada) { resultados.hidden = true; vacio.hidden = true; estadoBusqueda.textContent = ''; return; }
    if (!filas) crearFilas();
    const pal = q ? q.split(/\s+/) : [];
    let n = 0;
    for (const { p, li } of filas!) {
      const si = n < 60 &&
        pal.every((w) => p.texto.includes(w)) &&
        (!filtros.has('favorito') || p.favorito) &&
        (!filtros.has('sinPicante') || (p.comida && p.picante === 0)) &&
        (!filtros.has('cocido') || (p.comida && !p.crudo));
      if (si) n++;
      if (li.hidden === si) li.hidden = !si;
    }
    anunciarResultados(n);
    vacio.hidden = n > 0;
    resultados.hidden = n === 0;
  }
  input.addEventListener('input', buscar);
  let tBusqueda = 0;
  function anunciarResultados(n: number) {
    clearTimeout(tBusqueda);
    tBusqueda = window.setTimeout(() => {
      estadoBusqueda.textContent = n === 0 ? (es() ? 'Sin resultados.' : 'No matches.') : es() ? `${n} ${n === 1 ? 'resultado' : 'resultados'}` : `${n} ${n === 1 ? 'result' : 'results'}`;
    }, 400);
  }
  paneles.busca.querySelectorAll<HTMLButtonElement>('[data-filtro]').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset.filtro as Filtro;
    if (filtros.has(f)) filtros.delete(f); else filtros.add(f);
    b.setAttribute('aria-pressed', String(filtros.has(f)));
    buscar();
  }));

  /* ── Mi pedido: contador y rebote al recibir un platillo ── */
  function contar(n: number, total: string) {
    piezas = n;
    totalTxt = total;
    ponerContador(contador, n);
    btnLista.setAttribute('aria-label', etiquetaPedido(n, total, es() ? 'es' : 'en'));
    isla.dataset.lista = n > 0 ? 'si' : 'no';
  }
  /** Cuándo termina de subir la bolsa (la barra que aparece). */
  const bolsaListaEn = () => Math.max(0, tLista - performance.now());
  /** Caja final (en pantalla) del botón Mi pedido, aunque la barra aún esté subiendo:
   *  se mide sin la traslación de entrada (offset dentro de la barra, que no se mueve). */
  function destinoBolsa() {
    if (estado !== 'pildora') return null;
    const b = barra.getBoundingClientRect();
    return { x: b.left + btnLista.offsetLeft, y: b.top + btnLista.offsetTop, w: btnLista.offsetWidth, h: btnLista.offsetHeight };
  }
  /** El botón se hincha al recibir un platillo (la bolsa y el contador los anima bolsa.ts).
   *  Si llegan varios seguidos, cada rebote reemplaza al anterior (no se acumulan escalas). */
  let rebote: Animation | null = null;
  function rebotar(conBoton = true) {
    if (estado === 'oculta') mostrar(true);
    if (o.reducir() || estado !== 'pildora' || !conBoton) return;
    rebote?.cancel();
    rebote = btnLista.animate(
      [{ scale: '1' }, { scale: '1.08', offset: 0.3 }, { scale: '1' }],
      { duration: 380, easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)' },
    );
  }

  /* ── Deslizar la sección actual: el nombre sigue al dedo con resistencia y cambia a la vecina ── */
  let x0 = 0; let arrastre = 0; let deslizo = false; let siguiendo = false;
  pildora.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    x0 = e.clientX; arrastre = 0; deslizo = false; siguiendo = true;
    pildora.setPointerCapture(e.pointerId);
    texto.classList.remove('suelta');
  });
  pildora.addEventListener('pointermove', (e) => {
    if (!siguiendo) return;
    arrastre = e.clientX - x0;
    if (Math.abs(arrastre) > 6 && !o.reducir()) {
      const d = arrastre;
      const amortiguado = (d * 60) / (60 + Math.abs(d) * 0.55);
      texto.style.transform = `translateX(${amortiguado.toFixed(1)}px)`;
      texto.style.opacity = String(1 - Math.min(Math.abs(d), 120) / 260);
    }
  });
  const soltar = (cambiar: boolean) => {
    if (!siguiendo) return;
    siguiendo = false;
    texto.classList.add('suelta');
    texto.style.transform = '';
    texto.style.opacity = '';
    if (cambiar && Math.abs(arrastre) > 45) {
      deslizo = true;
      const n = Math.max(0, Math.min(o.cats.length - 1, idx + (arrastre < 0 ? 1 : -1)));
      if (n !== idx) o.ir(o.cats[n]!.id);
    }
  };
  pildora.addEventListener('pointerup', () => soltar(true));
  pildora.addEventListener('pointercancel', () => soltar(false));
  pildora.addEventListener('click', () => {
    if (deslizo) { deslizo = false; return; }
    if (abierto === 'cats') cerrar(); else abrir(false);
  });
  pildora.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = Math.max(0, Math.min(o.cats.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)));
    if (n !== idx) o.ir(o.cats[n]!.id);
  });
  lupa.addEventListener('click', () => { if (abierto === 'busca') cerrar(); else abrir(true); });
  btnLista.addEventListener('click', () => o.abrirLista());
  velo.addEventListener('click', () => cerrar());
  for (const p of Object.values(paneles)) {
    p.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const ir = t.closest<HTMLElement>('[data-ir]');
      const pl = t.closest<HTMLElement>('[data-platillo]');
      if (t.closest('[data-isla-cerrar]')) cerrar();
      else if (ir) {
        // Cerrar y saltar en el mismo toque: la hoja baja (compositor) mientras la sección llega.
        cerrar(false);
        o.ir(ir.dataset.ir!);
        pildora.focus({ preventScroll: true });
      } else if (pl) {
        cerrar(false);
        setTimeout(() => o.abrir(pl.dataset.platillo!), o.reducir() ? 0 : 180);
      }
    });
  }
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && estado === 'abierta') cerrar(); });
  document.addEventListener('focusin', (e) => {
    if (estado !== 'abierta' || !abierto) return;
    const t = e.target as HTMLElement;
    if (paneles[abierto].contains(t) || t.closest('dialog') || (escritorio.matches && barra.contains(t))) return;
    primerFoco(abierto).focus({ preventScroll: true });
  });
  // Pasar de teléfono a computadora (girar la tableta) con un panel abierto: se cierra limpio.
  escritorio.addEventListener('change', () => cerrar(false));

  return {
    mostrar, actualizar, cerrar, contar, rebotar, destinoBolsa, bolsaListaEn, abrir,
    /** Se conserva por compatibilidad: la barra se acomoda sola con CSS (flex), no hay geometría que recalcular. */
    pintar() {},
    get indice() { return idx; }, get estado() { return estado; }, pildora: () => pildora, bolsaEl: () => btnLista,
    /** Al cambiar de idioma: la etiqueta del botón del pedido. */
    idioma() { btnLista.setAttribute('aria-label', etiquetaPedido(piezas, totalTxt, es() ? 'es' : 'en')); },
  };
}
