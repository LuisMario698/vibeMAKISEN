// Isla dinámica de "oro líquido". Las manchas (.mancha) viven bajo un filtro SVG goo:
// cuando se acercan se funden y cuando se separan se estiran como un líquido.
// Aquí solo se calcula la geometría de cada estado; el movimiento lo hace CSS.

type Txt = { es: string; en: string };
type Cat = { id: string; nombre: Txt };
type Resultado = { id: string; nombre: Txt; cat: Txt; precio: string; foto?: string | undefined; texto: string };
type Caja = { l: number; b: number; w: number; h: number; r?: number };
type Estado = 'oculta' | 'pildora' | 'abierta';

export function crearIsla(o: {
  cats: Cat[];
  platillos: Resultado[];
  ir: (id: string) => void;
  abrir: (id: string) => void;
  reducir: () => boolean;
}) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
  const isla = $('#isla');
  const velo = $('#isla-velo');
  const cuerpo = $('.mancha.cuerpo');
  const boton = $('.mancha.boton');
  const gotas = [...isla.querySelectorAll<HTMLElement>('.mancha.gota')];
  const pildora = $<HTMLButtonElement>('.isla-pildora');
  const lupa = $<HTMLButtonElement>('.isla-lupa');
  const panel = $('#isla-panel');
  const actual = $('.isla-pildora .actual');
  const num = $('.isla-pildora .num');
  const avance = $('.isla-pildora .avance');
  const input = $<HTMLInputElement>('#buscar');
  const cats = $('.isla-cats');
  const resultados = $('.isla-resultados');
  const vacio = $('.isla-vacio');

  let estado: Estado = 'oculta';
  let idx = -1;
  const ctx = document.createElement('canvas').getContext('2d')!;
  const es = () => document.documentElement.lang !== 'en';

  // Escalonado de la lista del panel
  panel.querySelectorAll<HTMLElement>('.isla-item').forEach((li, k) => li.style.setProperty('--k', String(k)));

  const H = 54; // alto de la píldora y diámetro del botón
  const GAP = 8;
  const ancho = () => Math.min(innerWidth - 24, 440);
  const altoPanel = () => Math.round(Math.min(innerHeight * 0.76, 620));

  function medir(t: string) {
    ctx.font = '600 15px Poppins, system-ui, sans-serif';
    return Math.ceil(ctx.measureText(t).width);
  }
  function poner(el: HTMLElement, c: Caja) {
    el.style.left = `${c.l}px`;
    el.style.bottom = `${c.b}px`;
    el.style.width = `${c.w}px`;
    el.style.height = `${c.h}px`;
    if (c.r !== undefined) el.style.borderRadius = `${c.r}px`;
  }
  function sinTransicion(els: HTMLElement[], fn: () => void) {
    els.forEach((e) => e.classList.add('quieta'));
    fn();
    void isla.offsetWidth;
    els.forEach((e) => e.classList.remove('quieta'));
  }

  function geo() {
    const W = ancho();
    const nombre = idx >= 0 ? o.cats[idx]!.nombre[es() ? 'es' : 'en'] : '';
    const cw = Math.max(168, Math.min(W - H - GAP, 9 + 36 + 10 + medir(nombre) + 10 + 20 + 16));
    const l0 = (W - (cw + GAP + H)) / 2;
    return { W, cw, l0, P: altoPanel() };
  }

  function pintar() {
    const g = geo();
    isla.style.width = `${g.W}px`;
    isla.style.height = `${g.P}px`;
    isla.style.setProperty('--alto-panel', `${g.P}px`);
    const pill: Caja = { l: g.l0, b: 0, w: g.cw, h: H, r: H / 2 };
    const btn: Caja = { l: g.l0 + g.cw + GAP, b: 0, w: H, h: H, r: H / 2 };
    const centro = (d: number): Caja => ({ l: g.l0 + g.cw / 2 - d / 2, b: (H - d) / 2, w: d, h: d, r: d / 2 });
    if (estado === 'oculta') {
      const c: Caja = { l: (g.W - H) / 2, b: -120, w: H, h: H, r: H / 2 };
      poner(cuerpo, c); poner(boton, c);
      gotas.forEach((d) => poner(d, { ...c, w: 16, h: 16, r: 8, l: c.l + 19 }));
    } else if (estado === 'pildora') {
      poner(cuerpo, pill); poner(boton, btn);
      gotas.forEach((d) => poner(d, centro(16)));
    } else {
      poner(cuerpo, { l: 0, b: 0, w: g.W, h: g.P, r: 32 });
      // El botón se hunde en la esquina del panel: el líquido lo absorbe.
      poner(boton, { l: g.W - 58, b: g.P - 58, w: 40, h: 40, r: 20 });
    }
    poner(pildora, pill);
    poner(lupa, btn);
  }

  /* ── Mostrar / ocultar: cae una gota y se divide en píldora + botón ── */
  function mostrar(si: boolean) {
    if (si && estado === 'oculta') {
      const g = geo();
      estado = 'pildora';
      isla.dataset.estado = 'pildora';
      if (o.reducir()) { pintar(); return; }
      // Fase 1: una sola gota sube. Fase 2: se estira y se divide.
      const c: Caja = { l: (g.W - H) / 2, b: 0, w: H, h: H, r: H / 2 };
      poner(cuerpo, c); poner(boton, c);
      setTimeout(pintar, 300);
    } else if (!si && estado === 'pildora') {
      estado = 'oculta';
      isla.dataset.estado = 'oculta';
      pintar();
    }
  }

  /* ── Categoría actual: el texto rueda, la píldora se ajusta y salta una gota ── */
  function actualizar(nuevo: number, dir = 1) {
    if (nuevo === idx || nuevo < 0) return;
    const antes = idx;
    idx = nuevo;
    const c = o.cats[idx]!;
    actual.innerHTML = `<span lang="es">${c.nombre.es}</span><span lang="en">${c.nombre.en}</span>`;
    num.textContent = String(idx + 1).padStart(2, '0');
    avance.style.strokeDashoffset = String(100 - ((idx + 1) / o.cats.length) * 100);
    panel.querySelectorAll('[data-ir]').forEach((b) => b.setAttribute('aria-current', String((b as HTMLElement).dataset.ir === c.id)));
    if (estado !== 'pildora') { pintar(); return; }
    pintar();
    if (antes < 0 || o.reducir()) return;
    actual.animate(
      [{ transform: `translateY(${dir * 70}%)`, opacity: 0, filter: 'blur(4px)' }, { transform: 'none', opacity: 1, filter: 'none' }],
      { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
    salpicar(dir);
  }

  function salpicar(dir: number) {
    const g = geo();
    const d = gotas[0]!;
    const x = g.l0 + g.cw / 2 + dir * Math.min(60, g.cw / 4) - 9;
    sinTransicion([d], () => poner(d, { l: x, b: 18, w: 18, h: 18, r: 9 }));
    requestAnimationFrame(() => {
      poner(d, { l: x + dir * 10, b: H + 16, w: 16, h: 16, r: 8 });
      setTimeout(() => { if (estado === 'pildora') poner(d, { l: g.l0 + g.cw / 2 - 8, b: (H - 16) / 2, w: 16, h: 16, r: 8 }); }, 300);
    });
  }

  /* ── Abrir: el líquido se derrama hacia arriba y salpica ── */
  let foco: HTMLElement | null = null;
  function abrir(conBusqueda = false) {
    if (estado === 'abierta') return;
    if (estado === 'oculta') { estado = 'pildora'; pintar(); }
    foco = document.activeElement as HTMLElement;
    const g = geo();
    estado = 'abierta';
    isla.dataset.estado = 'abierta';
    pildora.setAttribute('aria-expanded', 'true');
    velo.classList.add('on');
    document.documentElement.classList.add('isla-abierta');
    panel.inert = false;
    if (!o.reducir()) {
      // Gotas que saltan antes de que el panel las alcance.
      const xs = [0.18, 0.52, 0.82];
      gotas.forEach((d, i) => {
        d.classList.add('rapida');
        poner(d, { l: g.W * xs[i]! - 11, b: 90 + i * 70 + (i % 2) * 40, w: 22 - i * 3, h: 22 - i * 3, r: 11 });
      });
      setTimeout(() => gotas.forEach((d) => { d.classList.remove('rapida'); poner(d, { l: g.W / 2 - 8, b: g.P / 2, w: 16, h: 16, r: 8 }); }), 420);
    }
    pintar();
    setTimeout(() => {
      panel.classList.add('lista');
      (conBusqueda ? input : (panel.querySelector<HTMLElement>('[data-ir][aria-current="true"]') ?? input)).focus({ preventScroll: true });
    }, o.reducir() ? 0 : 230);
  }

  /* ── Cerrar: el panel escurre de vuelta a la píldora ── */
  function cerrar(devolverFoco = true) {
    if (estado !== 'abierta') return;
    const g = geo();
    panel.classList.remove('lista');
    panel.inert = true;
    velo.classList.remove('on');
    document.documentElement.classList.remove('isla-abierta');
    pildora.setAttribute('aria-expanded', 'false');
    estado = 'pildora';
    isla.dataset.estado = 'pildora';
    if (!o.reducir()) {
      // Gotas que quedan colgando y luego caen a la píldora.
      sinTransicion(gotas, () => gotas.forEach((d, i) => poner(d, { l: g.W * (0.25 + i * 0.25) - 10, b: 70 + i * 50, w: 20, h: 20, r: 10 })));
    }
    setTimeout(pintar, o.reducir() ? 0 : 60);
    if (devolverFoco) (foco ?? pildora).focus({ preventScroll: true });
  }

  /* ── Búsqueda dentro de la isla ── */
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  input.addEventListener('input', () => {
    const q = norm(input.value);
    if (!q) { cats.hidden = false; resultados.hidden = true; vacio.hidden = true; return; }
    const pal = q.split(/\s+/);
    const hits = o.platillos.filter((p) => pal.every((w) => p.texto.includes(w))).slice(0, 40);
    cats.hidden = true;
    vacio.hidden = hits.length > 0;
    resultados.hidden = hits.length === 0;
    resultados.innerHTML = hits
      .map(
        (p, k) => `<li style="--k:${k}"><button type="button" data-platillo="${p.id}" class="isla-res presionable">
          <span class="miniatura">${p.foto ? `<img src="/menu/${p.foto}.webp" alt="" loading="lazy">` : '<img src="/brand/logo-isotipo.png" alt="" class="isotipo">'}</span>
          <span class="min-w-0 flex-1 text-left"><span class="block truncate text-[15px] font-semibold"><span lang="es">${p.nombre.es}</span><span lang="en">${p.nombre.en}</span></span>
          <span class="block truncate text-[12px] text-noche/65"><span lang="es">${p.cat.es}</span><span lang="en">${p.cat.en}</span></span></span>
          <span class="text-[15px] font-bold tabular-nums">${p.precio}</span></button></li>`,
      )
      .join('');
  });

  /* ── Eventos ── */
  let x0 = 0; let arrastre = 0; let deslizo = false;
  pildora.addEventListener('pointerdown', (e) => { x0 = e.clientX; arrastre = 0; deslizo = false; pildora.setPointerCapture(e.pointerId); });
  pildora.addEventListener('pointermove', (e) => {
    if (!pildora.hasPointerCapture(e.pointerId)) return;
    arrastre = e.clientX - x0;
    if (Math.abs(arrastre) > 6 && !o.reducir()) cuerpo.style.transform = `translateX(${arrastre * 0.18}px) scaleX(${1 + Math.min(Math.abs(arrastre), 120) / 900})`;
  });
  const soltar = () => {
    cuerpo.style.transform = '';
    if (Math.abs(arrastre) > 45) {
      deslizo = true;
      const dir = arrastre < 0 ? 1 : -1;
      const n = Math.max(0, Math.min(o.cats.length - 1, idx + dir));
      if (n !== idx) o.ir(o.cats[n]!.id);
    }
  };
  pildora.addEventListener('pointerup', soltar);
  pildora.addEventListener('pointercancel', () => { cuerpo.style.transform = ''; });
  pildora.addEventListener('click', () => { if (deslizo) { deslizo = false; return; } abrir(); });
  pildora.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const n = Math.max(0, Math.min(o.cats.length - 1, idx + (e.key === 'ArrowRight' ? 1 : -1)));
      o.ir(o.cats[n]!.id);
    }
  });
  lupa.addEventListener('click', () => abrir(true));
  velo.addEventListener('click', () => cerrar());
  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const ir = t.closest<HTMLElement>('[data-ir]');
    const pl = t.closest<HTMLElement>('[data-platillo]');
    if (t.closest('[data-isla-cerrar]')) cerrar();
    else if (ir) { cerrar(false); setTimeout(() => o.ir(ir.dataset.ir!), o.reducir() ? 0 : 260); }
    else if (pl) { cerrar(false); setTimeout(() => o.abrir(pl.dataset.platillo!), o.reducir() ? 0 : 320); }
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && estado === 'abierta') cerrar(); });
  document.addEventListener('focusin', (e) => {
    if (estado === 'abierta' && !panel.contains(e.target as Node) && !(e.target as HTMLElement).closest('dialog')) input.focus({ preventScroll: true });
  });
  addEventListener('resize', () => pintar());

  if (o.reducir()) isla.classList.add('sin-movimiento');
  pintar();
  return { mostrar, actualizar, pintar, cerrar, get indice() { return idx; } };
}
