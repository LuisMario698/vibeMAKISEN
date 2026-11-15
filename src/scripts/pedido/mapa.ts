// Mapa de entrega (solo "A domicilio"). Leaflet se carga con import dinámico la
// primera vez que se necesita, así no pesa en la carga del menú.
// Teselas oscuras de CARTO con atribución © OpenStreetMap © CARTO.
// Se arrastra con un dedo o el ratón; un toque mueve el pin dorado ahí y el pin también
// se arrastra. Si las teselas de CARTO fallan, cambia solo a las de OpenStreetMap.
//
// En el teléfono el contenedor cambia de tamaño (el panel se abre, se gira la pantalla,
// aparece el teclado): un ResizeObserver avisa a Leaflet para que nunca quede gris a medias.
// El plazo de respaldo (sin teselas → OSM) solo corre cuando el mapa ya pidió teselas, no
// mientras está oculto con tamaño cero.
import type { Coordenada } from '../../lib/ubicacion';

export type Mapa = {
  mover(c: Coordenada, acercar?: boolean): void;
  ajustar(): void;
  quitar(): void;
};

const PIN = '<span class="pd-pin"><svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 1C8 1 2 7 2 15c0 10 14 25 14 25s14-15 14-25C30 7 24 1 16 1z" fill="#d2b26a" stroke="#050505" stroke-width="2"/><circle cx="16" cy="15" r="5.5" fill="#050505"/></svg></span><span class="pd-pin-sombra"></span>';
const LOCAL = '<span class="pd-local"><img src="/brand/isotipo.svg" alt="" width="22" height="22"></span>';

async function cargarCss() {
  if (document.querySelector('link[data-leaflet]')) return;
  const { default: href } = await import('leaflet/dist/leaflet.css?url');
  await new Promise<void>((ok) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.dataset.leaflet = '';
    l.onload = () => ok(); l.onerror = () => ok();
    document.head.append(l);
  });
}

export async function crearMapa(el: HTMLElement, o: {
  centro: Coordenada; inicial: Coordenada | null; etiquetas: { pin: string; local: string };
  alMover: (c: Coordenada) => void; alFallarTeselas: () => void;
}): Promise<Mapa> {
  // La hoja de estilos de Leaflet se inyecta solo aquí (como import normal Astro la
  // subía a la carga inicial y bloqueaba el render del menú).
  const [mod] = await Promise.all([import('leaflet'), cargarCss()]);
  const L = (mod as unknown as { default?: typeof import('leaflet') }).default ?? (mod as unknown as typeof import('leaflet'));
  // Un intento anterior que falló a medias pudo dejar el contenedor marcado por Leaflet.
  delete (el as HTMLElement & { _leaflet_id?: number })._leaflet_id;
  el.replaceChildren();
  const mapa = L.map(el, {
    center: [o.centro.lat, o.centro.lng],
    zoom: 15,
    dragging: true,
    scrollWheelZoom: false,
    touchZoom: true,
    zoomControl: true,
    attributionControl: true,
    // Un toque con el dedo que tiembla un poco sigue siendo un toque (no un arrastre).
    tapTolerance: 18,
  });
  mapa.attributionControl.setPrefix(false);
  const OSM = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  let fallos = 0; let cargadas = 0; let respaldo = false; let plazo = 0;
  const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd', maxZoom: 19, attribution: `${OSM} © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`,
  });
  // Respaldo: OpenStreetMap estándar, oscurecido con CSS para que combine con el mármol.
  const usarRespaldo = () => {
    if (respaldo) return;
    respaldo = true;
    clearTimeout(plazo);
    mapa.removeLayer(carto);
    let osmCargadas = 0; let osmFallos = 0;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: OSM, className: 'pd-teselas-osm' })
      .on('tileload', () => { osmCargadas++; })
      .on('tileerror', () => { osmFallos++; if (osmCargadas === 0 && osmFallos >= 2) o.alFallarTeselas(); })
      .addTo(mapa);
  };
  carto.on('tileload', () => { cargadas++; clearTimeout(plazo); });
  carto.on('tileerror', () => { fallos++; if (cargadas === 0 && fallos >= 2) usarRespaldo(); });
  // Si 8 s después de pedir las primeras teselas no llegó ninguna (red que bloquea CARTO), se cambia.
  carto.on('loading', () => { if (!plazo && !respaldo && cargadas === 0) plazo = window.setTimeout(() => { if (cargadas === 0) usarRespaldo(); }, 8000); });
  carto.addTo(mapa);

  L.marker([o.centro.lat, o.centro.lng], {
    icon: L.divIcon({ html: LOCAL, className: 'pd-icono-local', iconSize: [34, 34], iconAnchor: [17, 17] }),
    keyboard: false, interactive: false, title: o.etiquetas.local,
  }).addTo(mapa);

  // El pin aparece cuando el cliente toca el mapa o usa su ubicación (no se confunde con el local).
  const inicio = o.inicial ?? o.centro;
  const pin = L.marker([inicio.lat, inicio.lng], {
    draggable: true, autoPan: true, keyboard: true, title: o.etiquetas.pin, alt: o.etiquetas.pin,
    icon: L.divIcon({ html: PIN, className: 'pd-icono-pin', iconSize: [32, 42], iconAnchor: [16, 41] }),
  });
  const poner = () => { if (!mapa.hasLayer(pin)) pin.addTo(mapa); };
  if (o.inicial) { poner(); mapa.setView([o.inicial.lat, o.inicial.lng], 17); }

  const soltar = () => {
    const e = pin.getElement()?.querySelector<HTMLElement>('.pd-pin');
    if (!e) return;
    e.classList.remove('cae'); void e.offsetWidth; e.classList.add('cae');
  };
  const avisar = () => { const p = pin.getLatLng(); o.alMover({ lat: p.lat, lng: p.lng }); };
  pin.on('dragstart', () => pin.getElement()?.classList.add('arrastrando'));
  pin.on('dragend', () => { pin.getElement()?.classList.remove('arrastrando'); soltar(); avisar(); });
  mapa.on('click', (e: { latlng: { lat: number; lng: number } }) => { pin.setLatLng(e.latlng); poner(); soltar(); avisar(); });

  // Cada vez que el contenedor cambia de tamaño (incluido pasar de oculto a visible), Leaflet
  // recalcula y pide las teselas que faltan. Sin ResizeObserver queda el ajuste manual.
  let ultimo = '';
  const ajustar = () => {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const t = `${w}x${h}`;
    if (t === ultimo) return;
    ultimo = t;
    mapa.invalidateSize();
  };
  if ('ResizeObserver' in window) new ResizeObserver(() => requestAnimationFrame(ajustar)).observe(el);

  return {
    mover(c, acercar = false) {
      pin.setLatLng([c.lat, c.lng]);
      poner();
      if (acercar) mapa.setView([c.lat, c.lng], 17, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
      else mapa.panTo([c.lat, c.lng]);
      soltar();
    },
    ajustar() { ultimo = ''; ajustar(); },
    quitar() { pin.remove(); mapa.panTo([o.centro.lat, o.centro.lng]); },
  };
}
