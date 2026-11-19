// Modo presentación (?demo=1) de punta a punta con Playwright contra `astro preview`.
// Uso: npm run build && (npx astro preview --port 4372 &) && BASE=http://127.0.0.1:4372 node e2e/presentacion.mjs
// El recorrido completo va acelerado con ?rapido=1 (solo pruebas); la pausa se prueba a velocidad normal.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules', '/usr/lib/node_modules'] })); }
const { chromium } = pw;

const BASE = process.env.BASE ?? 'http://localhost:4372';
const PASOS = ['portada', 'secciones', 'busqueda', 'agregar', 'bebida', 'comanda', 'entrega', 'pago', 'enviar'];
// El carrito real del teléfono: un platillo. Al salir de la demostración debe seguir idéntico.
const CARRITO = { v: 1, t: Date.now(), modo: 'llevar', nombre: 'Ana', hora: 'pronto', direccion: '', referencias: '', lineas: [{ id: 'aguachile-mixto', n: 1 }] };
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };

// Registro dentro de la página (y del marco de teléfono del escenario, que es un iframe): pasos de
// la narración, alto de la banda en cada paso, vistas de «Mi pedido» y folio del seguimiento.
const REGISTRO = () => {
  const r = (window.__demo = { pasos: [], altos: [], vistas: [], folio: '', omitidos: [] });
  const warn = console.warn;
  console.warn = (...a) => { if (String(a[0]).startsWith('presentación')) r.omitidos.push(String(a[1])); warn.apply(console, a); };
  new MutationObserver(() => {
    const narra = document.querySelector('.pz-relato') ?? document.querySelector('.pz-banda');
    const p = narra?.getAttribute('data-paso');
    if (p && r.pasos.at(-1) !== p) {
      r.pasos.push(p);
      const b = document.querySelector('.pz-banda:not([hidden])');
      // Se mide un cuadro después (ya con el texto nuevo puesto).
      if (b) requestAnimationFrame(() => r.altos.push(Math.round(b.getBoundingClientRect().height)));
    }
    const v = document.getElementById('lista')?.getAttribute('data-paso');
    if (v && r.vistas.at(-1) !== v) r.vistas.push(v);
    const f = document.getElementById('pd-seg-folio')?.textContent?.trim();
    if (f) r.folio = f;
  }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
};

async function preparar(browser, w, h, ruta) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  const externos = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('request', (q) => { if (/wa\.me|whatsapp\.com|google\.[a-z.]+\/maps|maps\.app/.test(q.url())) externos.push(q.url()); });
  page.on('framenavigated', (f) => { if (f === page.mainFrame() && !f.url().startsWith(BASE)) externos.push(f.url()); });
  page.on('popup', (p) => externos.push(`popup ${p.url()}`));
  await page.route(/wa\.me|whatsapp\.com/, (r) => r.abort());
  await page.route('https://*.basemaps.cartocdn.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  await page.addInitScript(REGISTRO);
  // Estado real previo: carrito con un platillo y la mesa 7 de un QR en esta sesión.
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' });
  await page.evaluate((c) => {
    localStorage.setItem('makizen-lista', JSON.stringify(c));
    localStorage.removeItem('makizen-pedido');
    sessionStorage.setItem('makizen-mesa', '7');
  }, { ...CARRITO, t: Date.now() });
  // La app sanea el carrito al cargar (agrega el precio vigente): esa es la referencia.
  await page.reload({ waitUntil: 'networkidle' });
  const antes = await page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('makizen-lista')).lineas));
  return { ctx, page, errores, externos, antes };
}

async function estadoReal(page) {
  return page.evaluate(() => ({
    lista: (() => { try { return JSON.stringify(JSON.parse(localStorage.getItem('makizen-lista')).lineas); } catch { return null; } })(),
    pedido: localStorage.getItem('makizen-pedido'),
    mesa: sessionStorage.getItem('makizen-mesa'),
    contador: document.querySelector('#nav .nav-contador')?.textContent?.trim(),
    presentando: document.documentElement.classList.contains('presentando') || !!document.querySelector('.pz-banda, .pz-cursor, .pz-escena'),
  }));
}

/** El registro de la página y el de sus marcos (en escritorio el recorrido corre en el iframe). */
async function registro(page) {
  const regs = [];
  for (const f of page.frames()) { try { const r = await f.evaluate(() => window.__demo); if (r) regs.push(r); } catch { /* marco ido */ } }
  const main = regs[0] ?? { pasos: [], altos: [], vistas: [], folio: '', omitidos: [] };
  return { pasos: main.pasos, altos: main.altos, vistas: regs.flatMap((r) => r.vistas), folio: regs.map((r) => r.folio).find(Boolean) ?? '', omitidos: regs.flatMap((r) => r.omitidos) };
}

const browser = await chromium.launch();

/* ── Recorrido completo (acelerado) en español e inglés, teléfono y computadora ── */
for (const [idioma, ruta, w, h] of [['es', '/', 390, 844], ['es', '/', 1440, 900], ['en', '/en/', 390, 844], ['en', '/en/', 1280, 720], ['es', '/', 320, 568], ['en', '/en/', 320, 568], ['es', '/', 375, 667]]) {
  console.log(`\nrecorrido ${idioma} ${w}×${h}`);
  const escritorio = w >= 1024;
  const { ctx, page, errores, externos, antes } = await preparar(browser, w, h, ruta);
  await page.goto(`${BASE}${ruta}?demo=1&rapido=1`, { waitUntil: 'domcontentloaded' });
  ok((await page.evaluate(() => document.documentElement.lang)).startsWith(idioma), `idioma de la ruta (${idioma})`);
  await page.waitForSelector(escritorio ? '.pz-relato' : '.pz-banda', { timeout: 10_000 });
  ok(await page.evaluate(() => !document.querySelector('.pz-banda .pz-titulo, .pz-relato-titulo')?.closest('[inert]')), 'la narración no queda inerte');
  if (escritorio) {
    // Escenario: el menú corre dentro de un teléfono de 390×844 (lo que ven los comensales) y la narración va al lado, grande.
    const esc = await page.evaluate(() => {
      const f = document.querySelector('iframe.pz-pantalla');
      const r = f?.getBoundingClientRect();
      const t = document.querySelector('.pz-relato-titulo');
      const l = document.querySelector('.pz-relato-linea');
      const rr = document.querySelector('.pz-relato').getBoundingClientRect();
      return { iframe: !!f, ancho: f?.clientWidth, alto: f?.clientHeight, dentro: r && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0, titulo: parseFloat(getComputedStyle(t).fontSize), linea: parseFloat(getComputedStyle(l).fontSize), relatoDentro: rr.bottom <= innerHeight && rr.right <= innerWidth, src: f?.getAttribute('src') };
    });
    ok(esc.iframe && esc.ancho === 390 && esc.alto === 844, `el menú va en un teléfono de 390×844 (${esc.ancho}×${esc.alto}, ${esc.src})`);
    ok(esc.dentro && esc.relatoDentro, 'teléfono y narración caben en la pantalla');
    ok(esc.titulo >= 28 && esc.linea >= 20, `narración grande: título ${esc.titulo}px, línea ${esc.linea}px`);
    // El iframe del teléfono puede tardar en navegar (sobre todo en la red real): espéralo.
    let marco;
    for (let i = 0; i < 50 && !marco; i++) { marco = page.frames().find((f) => f.url().includes('marco=1')); if (!marco) await page.waitForTimeout(200); }
    await marco?.waitForSelector('html.presentando', { timeout: 10_000 }).catch(() => undefined);
    ok(!!marco && await marco.evaluate(() => innerWidth === 390 && getComputedStyle(document.querySelector('.pz-banda')).display === 'none'), 'dentro del teléfono: vista de teléfono y sin banda propia');
  }
  await page.waitForSelector('dialog.pz-final[open]', { timeout: 90_000 }).catch(() => undefined);
  const reg = await registro(page);
  ok(await page.locator('dialog.pz-final[open]').count() === 1, 'llega a la tarjeta final');
  ok(JSON.stringify(reg.pasos) === JSON.stringify(PASOS), `recorre los 9 pasos en orden (${reg.pasos.join(' → ')})`);
  ok(reg.omitidos.length === 0, `ningún paso omitido${reg.omitidos.length ? ` (${reg.omitidos.join(', ')})` : ''}`);
  for (const v of ['1', '2', '3', 'seguimiento']) ok(reg.vistas.includes(v), `«Mi pedido» pasa por la vista ${v}`);
  ok(/^MZ-[A-Z0-9]{4}$/.test(reg.folio), `seguimiento con folio (${reg.folio})`);
  ok(externos.length === 0, `nunca abre WhatsApp, teléfono ni mapa${externos.length ? ` (${externos.join(', ')})` : ''}`);
  ok(new URL(page.url()).searchParams.get('demo') === '1', 'sigue en la presentación (no navegó)');
  const titulo = (await page.locator('.pz-final-titulo').innerText()).trim();
  ok(titulo === (idioma === 'en' ? 'This is MAKIZEN, digital' : 'Así se vería MAKIZEN digital'), `tarjeta final en ${idioma}: «${titulo}»`);
  ok(await page.locator('.pz-final-lista li').count() === 3, 'tres beneficios');
  ok((await page.locator('.pz-final-siguiente').innerText()).includes(idioma === 'en' ? 'Shall we talk?' : '¿Lo platicamos?'), 'y el paso siguiente para el dueño');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal');
  await page.waitForTimeout(800);
  const botones = await page.locator('.pz-final-boton').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return { alto: r.height, top: r.top, bottom: r.bottom, vh: innerHeight }; }));
  ok(botones.length === 2 && botones.every((x) => x.alto >= 44), 'botones finales de ≥ 44 px');
  ok(botones.every((x) => x.top >= 0 && x.bottom <= x.vh), `los dos botones completos dentro de la pantalla (${botones.map((b) => `${Math.round(b.top)}–${Math.round(b.bottom)}`).join(', ')} de ${h})`);
  const cuerpo = await page.locator('.pz-final-cuerpo').evaluate((e) => ({ sh: e.scrollHeight, ch: e.clientHeight }));
  ok(cuerpo.sh <= cuerpo.ch + 1, `la tarjeta final cabe sin desplazarse (${cuerpo.sh}/${cuerpo.ch})`);
  if (!escritorio) {
    const altos = reg.altos;
    ok(altos.length >= 9 && Math.max(...altos) - Math.min(...altos) <= 1, `la banda mide lo mismo en cada paso (${[...new Set(altos)].join(', ')} px)`);
    ok(Math.max(...altos) <= h * 0.24, `la banda ocupa ≤ 24 % de la pantalla (${Math.max(...altos)} de ${h})`);
  }
  // Explorar yo mismo: se recarga sin ?demo y todo vuelve a su estado real.
  await page.locator('.pz-final-boton.boton-oro').click();
  await page.waitForURL((u) => !u.searchParams.has('demo'), { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  const real = await estadoReal(page);
  ok(new URL(page.url()).pathname === ruta && !page.url().includes('demo'), `vuelve a ${ruta} sin ?demo`);
  ok(real.lista === antes, 'el carrito real sigue intacto (1 platillo)');
  ok(real.contador === '1', 'el contador de Mi pedido marca 1');
  ok(real.pedido === null, 'no quedó un seguimiento falso');
  ok(real.mesa === '7', 'la mesa del QR sigue en la sesión');
  ok(!real.presentando, 'sin rastro de la presentación');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ` (${errores.join(' | ')})` : ''}`);
  await ctx.close();
}

/* ── Pausa al tocar, continuar, siguiente paso y Escape (velocidad normal) ── */
for (const [idioma, ruta] of [['es', '/'], ['en', '/en/']]) {
  console.log(`\ncontroles ${idioma} 390×844`);
  const { ctx, page, errores, externos, antes } = await preparar(browser, 390, 844, ruta);
  await page.goto(`${BASE}${ruta}?demo=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pz-banda.entra', { timeout: 12_000 });
  await page.waitForTimeout(1800);
  // Un toque de la persona sobre la página pausa (y no activa lo que hay debajo).
  await page.mouse.click(195, 600);
  ok(await page.locator('.pz-banda[data-estado="pausa"]').count() === 1, 'tocar la página pausa');
  const nombre = idioma === 'en' ? 'Resume' : 'Continuar';
  ok(await page.getByRole('button', { name: nombre, exact: true }).count() === 1, `el botón de pausa se llama «${nombre}» (nombre accesible)`);
  const avance1 = await page.locator('.pz-avance').evaluate((e) => e.style.transform);
  const scroll1 = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1800);
  ok(await page.locator('.pz-avance').evaluate((e) => e.style.transform) === avance1, 'en pausa el avance no corre');
  ok(await page.evaluate(() => scrollY) === scroll1, 'en pausa la página no se mueve sola');
  ok(await page.locator('#hoja[open], #lista[open]').count() === 0, 'el toque no abrió nada debajo');
  await page.locator('[data-pz="pausa"]').click();
  ok(await page.locator('.pz-banda[data-estado="pausa"]').count() === 0, 'continuar reanuda');
  // Siguiente paso.
  const paso = await page.locator('.pz-banda').getAttribute('data-paso');
  await page.locator('[data-pz="siguiente"]').click();
  await page.waitForFunction((p) => document.querySelector('.pz-banda')?.getAttribute('data-paso') !== p, paso, { timeout: 4000 }).catch(() => undefined);
  const otro = await page.locator('.pz-banda').getAttribute('data-paso');
  ok(PASOS.indexOf(otro) === PASOS.indexOf(paso) + 1, `«siguiente» pasa de ${paso} a ${otro}`);
  const t = await page.locator('.pz-titulo').innerText();
  ok(idioma === 'en' ? /Sections/i.test(t) : /Las secciones/i.test(t), `subtítulo en ${idioma}: «${t.replace(/\s+/g, ' ')}»`);
  const ctl = await page.locator('.pz-ctl').evaluateAll((bs) => bs.map((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height); }));
  ok(ctl.length === 3 && ctl.every((x) => x >= 44), 'controles de ≥ 44 px');
  await page.waitForTimeout(2500);
  // Escape sale: recarga sin ?demo y el estado real sigue igual.
  await page.keyboard.press('Escape');
  await page.waitForURL((u) => !u.searchParams.has('demo'), { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  const real = await estadoReal(page);
  ok(!page.url().includes('demo'), 'Escape sale y quita ?demo de la URL');
  ok(real.lista === antes && real.contador === '1', 'el carrito real sigue con su platillo');
  ok(real.mesa === '7' && real.pedido === null, 'mesa y seguimiento reales intactos');
  ok(!real.presentando, 'sin banda ni cursor después de salir');
  ok(externos.length === 0, 'nunca abre enlaces externos');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ` (${errores.join(' | ')})` : ''}`);
  await ctx.close();
}

/* ── Escenario de escritorio a velocidad normal: los controles de al lado mandan al teléfono ── */
{
  console.log('\nescenario 1280×720: controles');
  const { ctx, page, errores, externos, antes } = await preparar(browser, 1280, 720, '/');
  await page.goto(`${BASE}/?demo=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pz-relato[data-vio]', { timeout: 15_000 }).catch(() => undefined);
  ok(await page.locator('.pz-relato').getAttribute('data-paso') === 'portada', 'empieza por la portada');
  await page.locator('.pz-relato [data-pz="siguiente"]').click();
  await page.waitForFunction(() => document.querySelector('.pz-relato')?.dataset.paso === 'secciones', null, { timeout: 5000 }).catch(() => undefined);
  ok(await page.locator('.pz-relato').getAttribute('data-paso') === 'secciones', '«Siguiente» pasa el teléfono al paso 2');
  ok(await page.locator('.pz-indice li[aria-current="step"]').innerText().then((t) => /secciones/i.test(t)), 'el índice marca el paso actual');
  await page.locator('.pz-relato [data-pz="pausa"]').click();
  const marco = page.frames().find((f) => f.url().includes('marco=1'));
  ok(await marco.waitForSelector('.pz-banda[data-estado="pausa"]', { state: 'attached', timeout: 3000 }).then(() => true, () => false), 'Pausar detiene el recorrido dentro del teléfono');
  ok(await page.getByRole('button', { name: 'Continuar', exact: true }).count() === 1, 'el botón dice «Continuar»');
  // Tocar el teléfono también pausa (y el escenario lo sabe).
  await page.locator('.pz-relato [data-pz="pausa"]').click();
  await page.waitForTimeout(400);
  const caja = await page.locator('iframe.pz-pantalla').boundingBox();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height * 0.6);
  ok(await page.waitForSelector('.pz-relato[data-estado="pausa"]', { timeout: 3000 }).then(() => true, () => false), 'un toque en el teléfono pausa y el escenario lo muestra');
  await page.keyboard.press('Escape');
  await page.waitForURL((u) => !u.searchParams.has('demo'), { timeout: 8000 });
  await page.waitForLoadState('networkidle');
  const real = await estadoReal(page);
  ok(real.lista === antes && real.contador === '1' && real.mesa === '7' && real.pedido === null, 'al salir, carrito, mesa y seguimiento reales intactos');
  ok(!real.presentando, 'sin rastro del escenario');
  ok(externos.length === 0 && errores.length === 0, `sin enlaces externos ni errores${errores.length ? ` (${errores.join(' | ')})` : ''}`);
  await ctx.close();
}

/* ── Con la guía del comensal: en la demostración no sale nada de la guía y no queda rastro ── */
// Visita nueva (sin 'makizen-guia'), con el QR de una mesa en ES para que la bienvenida tuviera motivo de salir.
for (const [idioma, ruta, extra] of [['es', '/', '&src=qr-mesa-3'], ['en', '/en/', '']]) {
  console.log(`\nguía apagada en la demostración ${idioma} 390×844`);
  const { ctx, page, errores, externos, antes } = await preparar(browser, 390, 844, ruta);
  // Se guarda el Storage original antes de que la demo lo aísle, para leer lo que de verdad queda.
  await page.addInitScript(() => {
    const g = Storage.prototype.getItem;
    window.__real = (k) => g.call(localStorage, k);
    window.__realSesion = (k) => g.call(sessionStorage, k);
    window.__vioGuia = [];
    new MutationObserver(() => {
      for (const sel of ['.gp', '.gc', '#guia-anuncio', '.guia-realce', '.guia-filtros', '.guia-elige']) if (document.querySelector(sel) && !window.__vioGuia.includes(sel)) window.__vioGuia.push(sel);
      if (document.getElementById('pd-guia-pasos')?.hidden === false && !window.__vioGuia.includes('pasos')) window.__vioGuia.push('pasos');
    }).observe(document, { subtree: true, childList: true, attributes: true });
  });
  // Se limpia al arrancar el documento de la demo (antes que cualquier script): la visita normal de
  // preparar() carga la guía en diferido y podría escribir 'makizen-guia' después de un borrado previo.
  await page.addInitScript(() => {
    if (window === top && /demo=1/.test(location.search) && !sessionStorage.getItem('__e2e-limpio')) {
      localStorage.removeItem('makizen-guia'); sessionStorage.removeItem('makizen-guia-off'); sessionStorage.setItem('__e2e-limpio', '1');
    }
  });
  const pedidos = [];
  page.on('request', (q) => pedidos.push(q.url()));
  await page.goto(`${BASE}${ruta}?demo=1&rapido=1${extra}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('dialog.pz-final[open]', { timeout: 90_000 }).catch(() => undefined);
  const reg = await page.evaluate(() => window.__demo);
  ok(await page.locator('dialog.pz-final[open]').count() === 1 && JSON.stringify(reg.pasos) === JSON.stringify(PASOS), 'la demostración llega completa a la tarjeta final');
  const vio = await page.evaluate(() => window.__vioGuia);
  ok(vio.length === 0, `ni pistas, ni bienvenida, ni realces, ni «Prueba el Camarón Roca»${vio.length ? ` (${vio.join(', ')})` : ''}`);
  ok(!pedidos.some((u) => /\/_astro\/guia\.[^/]*\.js/.test(u)), 'el código de la guía ni se descarga');
  ok(await page.evaluate(() => window.__real('makizen-guia') === null && window.__realSesion('makizen-guia-off') === null), 'no marca pistas como vistas (sin rastro en makizen-guia)');
  ok(await page.evaluate((a) => JSON.stringify(JSON.parse(window.__real('makizen-lista')).lineas) === a && window.__real('makizen-pedido') === null, antes), 'makizen-lista y el seguimiento reales intactos durante la demo');
  ok(externos.length === 0 && errores.length === 0, `sin enlaces externos ni errores${errores.length ? ` (${errores.join(' | ')})` : ''}`);
  await ctx.close();
}

/* ── En pausa, «¿Cómo pido?» → «Ver las pistas otra vez» no despierta la guía ni deja rastro ── */
{
  console.log('\n«¿Cómo pido?» con la demostración en pausa 390×844');
  const { ctx, page, errores } = await preparar(browser, 390, 844, '/');
  await page.addInitScript(() => {
    const g = Storage.prototype.getItem;
    window.__real = (k) => g.call(localStorage, k);
    window.__realSesion = (k) => g.call(sessionStorage, k);
  });
  await page.addInitScript(() => {
    if (window === top && /demo=1/.test(location.search) && !sessionStorage.getItem('__e2e-limpio')) {
      localStorage.removeItem('makizen-guia'); sessionStorage.setItem('makizen-guia-off', '1'); sessionStorage.setItem('__e2e-limpio', '1');
    }
  });
  await page.goto(`${BASE}/?demo=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.pz-banda.entra', { timeout: 12_000 });
  await page.locator('[data-pz="pausa"]').click();
  ok(await page.locator('.pz-banda[data-estado="pausa"]').count() === 1, 'en pausa');
  const como = page.locator('#menu [data-como-pido]').first();
  await como.scrollIntoViewIfNeeded();
  await como.click();
  // La hoja vive en el paquete de la guía (import dinámico): se espera a que llegue.
  ok(await page.waitForSelector('#como-pido[open]', { timeout: 6000 }).then(() => true, () => false), '«¿Cómo pido?» se abre en pausa');
  await page.locator('[data-cp-reiniciar]').click();
  await page.waitForFunction(() => !document.querySelector('#como-pido[open]'), null, { timeout: 4000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  ok(await page.locator('.gp, .gc').count() === 0, 'no salen pistas ni la sugerencia en la demostración');
  ok(await page.evaluate(() => window.__real('makizen-guia') === null && window.__realSesion('makizen-guia-off') === '1'), 'el reinicio queda en memoria: makizen-guia y el apagado de la sesión reales intactos');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ` (${errores.join(' | ')})` : ''}`);
  await ctx.close();
}

/* ── Sin ?demo: el modo presentación no se descarga ── */
{
  console.log('\nuso normal');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const pedidos = [];
  page.on('request', (q) => pedidos.push(q.url()));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  ok(!pedidos.some((u) => /presentacion/.test(u)), 'sin ?demo no se descarga el recorrido');
  ok(await page.locator('.pz-banda, .pz-cursor').count() === 0, 'sin banda ni cursor');
  await ctx.close();
}

/* ── prefers-reduced-motion: el recorrido funciona igual ── */
{
  console.log('\nmovimiento reducido 375×667');
  const { ctx, page, errores, externos } = await preparar(browser, 375, 667, '/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/?demo=1&rapido=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('dialog.pz-final[open]', { timeout: 90_000 }).catch(() => undefined);
  const reg = await page.evaluate(() => window.__demo);
  ok(await page.locator('dialog.pz-final[open]').count() === 1, 'llega a la tarjeta final');
  ok(JSON.stringify(reg.pasos) === JSON.stringify(PASOS) && reg.omitidos.length === 0, 'los 9 pasos, ninguno omitido');
  ok(externos.length === 0 && errores.length === 0, 'sin enlaces externos ni errores');
  await ctx.close();
}

await browser.close();
console.log(fallas ? `\n${fallas} falla(s)` : '\ntodo bien');
process.exit(fallas ? 1 : 0);
