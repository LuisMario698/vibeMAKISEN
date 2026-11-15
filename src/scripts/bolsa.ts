// La bolsa de «Mi pedido» (isla y barra superior) y el aviso «Agregado».
//  · Mientras un platillo vuela hacia ella, la bolsa abre la boca (.abierta) y el contador
//    conserva el número anterior; al llegar, la bolsa la cierra, se aplasta un poco, el
//    contador rueda al número nuevo (odómetro) y sale una onda dorada.
//  · El texto real del contador (textContent) siempre es el número vigente: lo visible se
//    pinta con ::before/::after desde data-antes/data-vista (no lo lee el lector de pantalla,
//    que usa la etiqueta del botón).
import { contadorVisible } from '../lib/detalle';
import { bi, reducir } from './comun';
import type { Caja } from './morfo';

export type Destino = { caja: Caja; el: HTMLElement };

const contadores = () => [...document.querySelectorAll<HTMLElement>('.isla-lista .contador, #nav .nav-contador')];
let esperando = 0;
let tEspera = 0;

/** Pone el número en un contador. Si un platillo va en camino, lo visible espera a que llegue. */
export function ponerContador(el: HTMLElement, n: number) {
  el.textContent = contadorVisible(n);
  // La primera vez (al cargar la página con un pedido guardado) no rueda.
  if (!esperando) pintarVista(el, el.dataset.listo === '1');
  el.dataset.listo = '1';
}

function pintarVista(el: HTMLElement, rodar: boolean) {
  const nuevo = el.textContent ?? '';
  const antes = el.dataset.vista ?? nuevo;
  el.dataset.vista = nuevo;
  el.dataset.antes = antes;
  // El de la barra superior desaparece en cero (y vuelve a entrar con un pequeño salto).
  if (el.hasAttribute('data-ocultar-cero')) el.hidden = nuevo === '0';
  if (!rodar || antes === nuevo || reducir()) return;
  const sube = Number.parseInt(nuevo, 10) >= Number.parseInt(antes, 10) || antes === '';
  el.classList.remove('rueda', 'baja');
  void el.offsetWidth;
  el.classList.add('rueda');
  el.classList.toggle('baja', !sube);
}

/** Un platillo sale hacia la bolsa: los contadores conservan el número anterior hasta que llegue. */
export function esperar() {
  esperando++;
  clearTimeout(tEspera);
  // Seguro: si el vuelo no llega (pestaña oculta, animación cancelada), se sincroniza solo.
  tEspera = window.setTimeout(() => { esperando = 0; contadores().forEach((c) => pintarVista(c, false)); }, 2400);
}

/** La bolsa abre la boca para recibir el platillo. */
export function abrirBolsa(el: HTMLElement | null | undefined) {
  if (!el || reducir()) return;
  el.classList.add('abierta');
}

/** El platillo llegó: la bolsa cierra, se asienta, el contador rueda y sale una onda. */
export function recibirBolsa(el: HTMLElement | null | undefined) {
  esperando = Math.max(0, esperando - 1);
  if (!esperando) clearTimeout(tEspera);
  contadores().forEach((c) => pintarVista(c, true));
  if (!el) return;
  el.classList.remove('abierta');
  if (reducir()) return;
  el.querySelector('.bolsa-ico')?.animate(
    [{ transform: 'scale(1, 1)' }, { transform: 'scale(1.14, 0.84)', offset: 0.28 }, { transform: 'scale(0.94, 1.08)', offset: 0.6 }, { transform: 'scale(1, 1)' }],
    { duration: 520, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  );
  const onda = el.querySelector<HTMLElement>('.bolsa-onda');
  if (onda) {
    onda.animate([{ transform: 'scale(0.7)', opacity: 0.9 }, { transform: 'scale(2.3)', opacity: 0 }], { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
    onda.animate([{ transform: 'scale(0.7)', opacity: 0.55 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 640, delay: 110, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'backwards' });
  }
}

/* ── Aviso «Agregado a tu pedido · Ver pedido» ─────────────────────────── */
let tAviso = 0;
let yAviso = 0;
export function avisarAgregado(o: { nombre: { es: string; en: string }; foto?: string | undefined; n: number; abrirPedido: () => void }) {
  const caja = document.getElementById('aviso-agregado');
  if (!caja || document.querySelector('dialog[open]')) return;
  const img = caja.querySelector<HTMLImageElement>('.aa-mini img');
  if (img) { if (o.foto) { img.src = o.foto; img.hidden = false; } else img.hidden = true; }
  const nombre = caja.querySelector('.aa-nombre');
  // bi() escapa el texto: el nombre viene del menú, no del cliente, y aun así se escapa.
  if (nombre) nombre.innerHTML = o.n > 1 ? `${o.n} × ${bi(o.nombre)}` : bi(o.nombre);
  const boton = caja.querySelector<HTMLButtonElement>('.aa-ver')!;
  boton.onclick = () => { ocultarAviso(true); o.abrirPedido(); };
  yAviso = scrollY;
  caja.hidden = false;
  caja.classList.remove('sale');
  // Reiniciar la entrada si ya estaba visible (otro platillo agregado enseguida).
  caja.classList.remove('entra');
  void caja.offsetWidth;
  caja.classList.add('entra');
  clearTimeout(tAviso);
  tAviso = window.setTimeout(() => ocultarAviso(), 3400);
}

export function ocultarAviso(inmediato = false) {
  const caja = document.getElementById('aviso-agregado');
  if (!caja || caja.hidden) return;
  clearTimeout(tAviso);
  if (inmediato || reducir()) { caja.hidden = true; caja.classList.remove('sale', 'entra'); return; }
  // Si el foco estaba en «Ver pedido», no se pierde al desaparecer el aviso.
  if (caja.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
  caja.classList.add('sale');
  tAviso = window.setTimeout(() => { caja.hidden = true; caja.classList.remove('sale', 'entra'); }, 220);
}

/** Mientras el cursor o el foco están en el aviso, no se va. */
export function prepararAviso() {
  const caja = document.getElementById('aviso-agregado');
  if (!caja) return;
  const pausar = () => clearTimeout(tAviso);
  const seguir = () => { clearTimeout(tAviso); tAviso = window.setTimeout(() => ocultarAviso(), 1800); };
  caja.addEventListener('pointerenter', pausar);
  caja.addEventListener('pointerleave', seguir);
  caja.addEventListener('focusin', pausar);
  caja.addEventListener('focusout', seguir);
  // Al seguir recorriendo el menú, el aviso se retira para no tapar los platillos.
  addEventListener('scroll', () => {
    if (caja.hidden || caja.classList.contains('sale') || caja.contains(document.activeElement)) return;
    if (Math.abs(scrollY - yAviso) > 90) ocultarAviso();
  }, { passive: true });
}
