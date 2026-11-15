// Animación de inicio: saltarla con un toque, clic, tecla o rueda, y quitar la capa al terminar.
// También: el botón que pausa el movimiento continuo de la portada (cinta, ola y destello).
// El movimiento es CSS (src/styles/intro.css); el guion en línea de Intro.astro decide si se muestra.
const html = document.documentElement;
const capa = document.getElementById('intro');

if (capa) {
  if (!html.classList.contains('intro')) {
    // No se mostró (otra visita en la sesión, movimiento reducido, prueba) o ya terminó.
    capa.remove();
  } else {
    const eventos = ['pointerdown', 'keydown', 'wheel'] as const;
    let tragarHasta = 0;
    let lista = false;

    const quitar = () => {
      if (lista) return;
      lista = true;
      html.classList.remove('intro', 'intro-espera');
      capa.remove();
      eventos.forEach((t) => removeEventListener(t, saltar, true));
      setTimeout(() => removeEventListener('click', tragar, true), 800);
    };

    // El toque que salta la intro no debe activar el botón o enlace que queda debajo.
    const tragar = (e: MouseEvent) => {
      if (performance.now() > tragarHasta) return;
      tragarHasta = 0;
      e.preventDefault();
      e.stopPropagation();
    };

    function saltar(e: Event) {
      if (capa!.classList.contains('saltar')) return;
      if (e.type === 'pointerdown') tragarHasta = performance.now() + 700;
      html.classList.remove('intro-espera');
      capa!.classList.add('saltar');
      setTimeout(quitar, 320);
    }

    capa.addEventListener('animationend', (e) => {
      if (e.target === capa && (e.animationName === 'intro-iris' || e.animationName === 'intro-seguro' || e.animationName === 'intro-salta')) quitar();
    });
    eventos.forEach((t) => addEventListener(t, saltar, { capture: true, passive: true }));
    addEventListener('click', tragar, true);
  }
}

/* ── Pausa de la portada (WCAG 2.2.2): la preferencia se recuerda en este navegador ── */
const pausa = document.getElementById('portada-pausa');
const inicio = document.getElementById('inicio');
if (pausa && inicio) {
  const CLAVE = 'makizen-portada-quieta';
  let quieta = false;
  try { quieta = localStorage.getItem(CLAVE) === '1'; } catch { /* sin almacenamiento: empieza en movimiento */ }
  const aplicar = () => { inicio.toggleAttribute('data-quieta', quieta); pausa.setAttribute('aria-pressed', String(quieta)); };
  aplicar();
  pausa.addEventListener('click', () => {
    quieta = !quieta;
    aplicar();
    try { if (quieta) localStorage.setItem(CLAVE, '1'); else localStorage.removeItem(CLAVE); } catch { /* nada que guardar */ }
  });
}
