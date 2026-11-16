// Prueba de punta a punta con Playwright contra `astro preview` (o BASE=https://…).
// Uso: npm run build && (npx astro preview --port 4329 &) && npm run e2e
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules', '/usr/lib/node_modules'] })); }
const { chromium } = pw;

const BASE = process.env.BASE ?? 'http://localhost:4329';
const TAMANOS = [['telefono', 390, 844], ['tablet', 820, 1180], ['computadora', 1440, 900]];
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
// "Mi pedido" no se desplaza: el cuerpo del panel cabe en su alto.
const sinScroll = (page) => page.evaluate(() => { const e = document.querySelector('#lista .lista-scroll'); return e.scrollHeight <= e.clientHeight + 1; });

const browser = await chromium.launch();
for (const [nombre, w, h] of TAMANOS) {
  console.log(`\n${nombre} (${w}×${h})`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.route('https://wa.me/**', (r) => r.abort());
  // Teselas del mapa: imagen vacía (la prueba no depende de la red externa).
  await page.route('https://*.basemaps.cartocdn.com/**', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64') }));
  await page.goto(`${BASE}/?src=qr-mesa-7`, { waitUntil: 'networkidle' });
  ok(new URL(page.url()).search === '', 'la URL queda sin ?src');
  ok(await page.evaluate(() => sessionStorage.getItem('makizen-mesa')) === '7', 'mesa 7 guardada en la sesión');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal');

  // Abrir un platillo con opción: la sopa exige elegir proteína.
  await page.locator('#entradas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="sopa-vietnamita"]').click();
  await page.waitForSelector('#hoja[open]');
  await page.waitForTimeout(400);
  if (nombre === 'computadora') ok(await page.locator('#hoja').getAttribute('data-forma') === 'ventana', 'detalle como ventana centrada');
  await page.locator('#hoja-agregar').click();
  ok(await page.locator('#hoja-op-error').isVisible(), 'pide elegir proteína');
  await page.locator('label.opcion:has(input[value="camaron"])').click();
  await page.locator('[data-mas]').click();
  await page.fill('#hoja-nota', 'sin cebolla');
  await page.locator('#hoja-agregar').click();
  await page.waitForFunction(() => !document.querySelector('#hoja').open && !document.documentElement.classList.contains('bloqueo') && !document.querySelector('#morfo:not([hidden]), .vuelo'), null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-lista') ?? 'null'));
  ok(guardada?.v === 1 && guardada.lineas[0]?.n === 2 && guardada.lineas[0]?.op === 'camaron', 'lista guardada: 2 sopas de camarón');
  ok((await page.locator('#nav .nav-contador').textContent()) === '2', 'Mi pedido (arriba) cuenta 2');
  ok((await page.locator('#morfo:not([hidden]), .vuelo').count()) === 0, 'no quedan capas de animación');
  ok(!(await page.evaluate(() => document.documentElement.classList.contains('bloqueo'))), 'la página no queda bloqueada');

  // Agotado: no se puede agregar.
  await page.locator('#bebidas-asiaticas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="hanagoi"]').click();
  await page.waitForSelector('#hoja[open]');
  ok(await page.locator('#hoja-agregar').isHidden(), 'agotado: sin botón de agregar');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#hoja').open && !document.documentElement.classList.contains('bloqueo') && !document.querySelector('#morfo:not([hidden]), .vuelo'), null, { timeout: 5000 });
  await page.waitForTimeout(400);

  // Agregar con un toque una bebida de la lista.
  await page.locator('#cervezas').scrollIntoViewIfNeeded();
  await page.locator('[data-agregar]').first().click();
  await page.waitForTimeout(200);
  ok((await page.locator('#nav .nav-contador').textContent()) === '3', 'bebida agregada con un toque');

  // Mi pedido: paso 1 → 2 (entrega). Mesa 7 del QR preseleccionada en el plano.
  ctx.on('page', (p) => p.close().catch(() => {}));
  const texto = async () => new URL((await page.locator('#lista-enviar').getAttribute('href')) ?? '#', BASE).searchParams.get('text') ?? '';
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.waitForTimeout(400);
  ok(await page.locator('.linea-lista').count() === 2, 'Mi pedido muestra 2 líneas en la comanda');
  ok(await sinScroll(page), 'paso 1 sin desplazamiento');
  // Stepper, quitar con "Deshacer" y nota editable.
  const segunda = page.locator('.linea-lista').nth(1);
  await segunda.locator('[data-l="mas"]').click();
  ok((await page.locator('.linea-lista').nth(1).locator('output').textContent()) === '2', 'el stepper suma');
  await page.locator('.linea-lista').nth(1).locator('[data-l="menos"]').click();
  ok((await page.locator('.linea-lista').nth(1).locator('output').textContent()) === '1', 'el stepper resta');
  ok(await page.locator('.linea-lista').nth(1).evaluate((li) => li.classList.contains('uno')), 'con 1 pieza el «−» se vuelve bote');
  await page.locator('.linea-lista').nth(1).locator('[data-l="menos"]').click();
  await page.waitForSelector('#pd-deshacer:not([hidden])');
  ok(await page.locator('.linea-lista').count() === 1, 'quitar una línea (bote en el stepper)');
  await page.locator('#pd-deshacer-boton').click();
  await page.waitForTimeout(300);
  ok(await page.locator('.linea-lista').count() === 2, '«Deshacer» la regresa');
  await page.locator('.linea-lista').nth(1).locator('[data-l="nota"]').click();
  await page.locator('.linea-lista').nth(1).locator('.ll-editar input').fill('bien fría');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  ok((await page.locator('.linea-lista').nth(1).locator('.ll-nota').textContent())?.includes('bien fría'), 'nota editada desde la tarjeta');
  await page.locator('#pd-seguir').click();
  await page.waitForTimeout(300);
  ok(await page.locator('input[name="modo"][value="mesa"]').isChecked(), 'modalidad en mesa por el QR');
  ok(await page.locator('.pd-mesa[data-mesa="7"][aria-pressed="true"]').count() === 1, 'mesa 7 marcada en el plano');
  ok((await page.inputValue('#lista-mesa')) === '7', 'mesa 7 escrita en la comanda');
  ok(await sinScroll(page), 'paso 2 (en mesa) sin desplazamiento');
  // El plano se abre en su propia capa, con el rótulo de ilustrativo.
  await page.locator('#pd-abrir-plano').click();
  await page.waitForSelector('[data-capa="plano"]:not([hidden])');
  ok((await page.locator('[data-capa="plano"] .pd-nota-plano').textContent())?.includes('ilustrativo'), 'plano en su capa con rótulo «ilustrativo»');
  // Mesa ocupada (demostración): no se elige. Mesa libre: sí.
  await page.locator('.pd-mesa[data-mesa="3"]').click({ force: true });
  ok(await page.locator('.pd-mesa[data-mesa="3"][aria-pressed="true"]').count() === 0, 'mesa ocupada no se elige');
  await page.locator('.pd-mesa[data-mesa="5"]').click();
  ok(await page.locator('.pd-mesa[data-mesa="5"][aria-pressed="true"]').count() === 1, 'mesa 5 elegida en el plano');
  ok((await page.locator('#pd-plano-listo').textContent())?.includes('mesa 5'), 'botón «Usar mesa 5»');
  await page.locator('#pd-plano-listo').click();
  await page.waitForSelector('[data-capa="plano"]', { state: 'hidden' });
  ok((await page.locator('#pd-mesa-elegida').textContent())?.includes('Mesa 5') && (await page.inputValue('#lista-mesa')) === '5', 'resumen de la mesa elegida');
  await page.locator('#pd-seguir').click();
  await page.waitForTimeout(300);
  ok(await sinScroll(page), 'paso 3 sin desplazamiento');
  // Sin forma de pago no se envía.
  await page.locator('#lista-enviar').click();
  ok(await page.locator('#err-pago').isVisible(), 'pide elegir efectivo o tarjeta');
  // Efectivo con "Otro monto": cambio calculado y en el mensaje.
  await page.locator('label.pago:has(input[value="efectivo"])').click();
  await page.locator('label.pd-chip:has(input[value="otro"])').click();
  await page.fill('#pd-paga-otro', '100');
  await page.locator('#lista-enviar').click();
  ok(await page.locator('#err-paga').isVisible(), 'un monto menor al total no se acepta');
  await page.fill('#pd-paga-otro', '1000');
  ok(await page.locator('#pd-cambio').isVisible(), 'muestra el cambio');
  let t = await texto();
  ok(t.includes('Pago: efectivo, paga con $1,000 (cambio: $'), 'mensaje con efectivo y cambio');
  await page.locator('label.pago:has(input[value="tarjeta"])').click();
  t = await texto();
  ok((await page.locator('#lista-enviar').getAttribute('href')).startsWith('https://wa.me/526381165691?text='), 'enlace a wa.me del negocio');
  ok(/Pedido MAKIZEN · MZ-[2-9A-Z]{4}/.test(t) && t.includes('En mesa: 5') && t.includes('2 x Sopa Vietnamita de Pollo o Camarón (Camarón)') && t.includes('Nota: sin cebolla') && t.includes('Pago: tarjeta') && t.includes('Precio final lo confirma el restaurante.'), 'mensaje completo con folio, mesa y pago');

  // Para llevar sin nombre: no deja avanzar y lo pide.
  await page.locator('#pd-atras').click();
  await page.waitForTimeout(300);
  await page.locator('label.modo:has(input[value="llevar"])').click();
  await page.locator('#pd-seguir').click();
  ok(await page.locator('#err-nombre').isVisible(), 'pide el nombre para llevar');
  await page.fill('#lista-nombre', 'Ana');
  if (await page.locator('#lista-hora optgroup option').count()) await page.selectOption('#lista-hora', { index: 1 });
  await page.locator('#pd-seguir').click();
  await page.waitForTimeout(300);
  await page.locator('label.pago:has(input[value="efectivo"])').click();
  t = await texto();
  ok(t.includes('Para llevar: Ana') && t.includes('Pago: efectivo'), 'mensaje para llevar con nombre, hora y efectivo');

  // A domicilio: dirección obligatoria y mapa.
  await page.locator('#pd-atras').click();
  await page.waitForTimeout(300);
  await page.locator('label.modo:has(input[value="domicilio"])').click();
  await page.locator('#pd-seguir').click();
  ok(await page.locator('#err-direccion').isVisible(), 'pide la dirección a domicilio');
  await page.fill('#lista-direccion', 'Calle 13 #45, Centro');
  await page.waitForSelector('#pd-mapa.leaflet-container', { timeout: 8000 }).catch(() => {});
  ok(await page.locator('#pd-mapa.leaflet-container').count() === 1, 'mapa de entrega cargado');
  ok(await page.locator('#pd-mapa .leaflet-control-attribution').textContent().then((s) => s.includes('OpenStreetMap') && s.includes('CARTO')), 'atribución © OpenStreetMap © CARTO');
  ok(await sinScroll(page), 'paso 2 (a domicilio) sin desplazamiento');
  // El mapa se abre en su propia capa a todo el panel.
  await page.locator('#pd-abrir-mapa').click();
  await page.waitForSelector('[data-capa="mapa"]:not([hidden])');
  await page.waitForTimeout(400);
  const caja = await page.locator('#pd-mapa').boundingBox();
  await page.mouse.click(caja.x + caja.width * 0.7, caja.y + caja.height * 0.35);
  await page.waitForTimeout(300);
  ok(await page.locator('#pd-mapa .pd-icono-pin').count() === 1 && await page.locator('#pd-mapa-estado.ok').count() === 1, 'tocar el mapa fija el pin dorado');
  await page.locator('[data-capa="mapa"] .pd-boton').click();
  await page.waitForSelector('[data-capa="mapa"]', { state: 'hidden' });
  ok(await page.locator('#pd-ubic-resumen.ok').count() === 1, 'el renglón del mapa dice que el punto quedó fijado');
  await page.locator('#pd-seguir').click();
  await page.waitForTimeout(300);
  t = await texto();
  ok(t.includes('Envío: lo confirma el restaurante.'), 'mensaje a domicilio con aviso de envío');
  ok(/Ubicación: https:\/\/maps\.google\.com\/\?q=-?\d+\.\d{6},-?\d+\.\d{6}/.test(t), 'mensaje con el enlace de ubicación (6 decimales)');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal con el pedido abierto');
  await page.screenshot({ path: `e2e/captura-${nombre}-lista.png` });

  // Enviar: se abre WhatsApp (interceptado) y aparece el seguimiento.
  await page.locator('#lista-enviar').click();
  await page.waitForSelector('[data-vista="seguimiento"]:not([hidden])', { timeout: 5000 });
  const enviado = await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-pedido') ?? 'null'));
  ok(/^MZ-[2-9A-Z]{4}$/.test(enviado?.folio ?? '') && (await page.locator('#pd-seg-folio').textContent()) === enviado.folio, 'seguimiento con folio guardado');
  ok(await page.locator('.pd-etapa').count() === 4, 'línea de tiempo con 4 etapas');
  ok(await sinScroll(page), 'seguimiento sin desplazamiento');
  ok((await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-lista') ?? '{"lineas":[]}').lineas.length)) === 0, 'el carrito queda vacío al enviar');
  ok((await page.locator('#pd-reenviar').getAttribute('href')) === enviado.url, '«Volver a enviar» usa el mismo enlace');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Idioma: /en/, título en inglés, USD visible y seguimiento en inglés.
  await page.locator('#nav [data-lang="en"]').click();
  await page.waitForTimeout(500);
  ok(new URL(page.url()).pathname === '/en/', 'la URL cambia a /en/');
  ok((await page.title()).startsWith('MAKIZEN Sushi & Seafood'), 'título en inglés');
  ok(await page.locator('.producto .text-humo:visible', { hasText: 'US$' }).first().isVisible(), 'USD visible');
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  const pregunta = new URL(await page.locator('#pd-preguntar').getAttribute('href')).searchParams.get('text') ?? '';
  ok(pregunta.includes(`my order ${enviado.folio}`), 'preguntar por el pedido en inglés');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  if (nombre === 'computadora') ok(await page.locator('.riel').isVisible(), 'índice lateral visible');
  await page.screenshot({ path: `e2e/captura-${nombre}.png` });
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

// Regresiones de la revisión: doble clic en Agregar y notas con emoji en un pedido largo.
{
  console.log('\nregresiones');
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#entradas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="camaron-roca"]').click();
  await page.waitForSelector('#hoja[open]');
  await page.waitForTimeout(300);
  await page.locator('#hoja-agregar').dblclick();
  await page.waitForFunction(() => !document.querySelector('#hoja').open, null, { timeout: 5000 });
  const l = await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-lista')));
  ok(l.lineas[0].n === 1, 'doble clic en Agregar suma solo 1');
  // Lista guardada con notas que ponen un emoji en el punto de corte del modo compacto.
  await page.evaluate(() => {
    const nota = 'a'.repeat(39) + '😀' + 'b'.repeat(39);
    const lineas = Array.from({ length: 12 }, (_, i) => ({ id: 'makizen-roll', n: 1, p: 240, nota: i + nota }));
    localStorage.setItem('makizen-lista', JSON.stringify({ v: 1, t: Date.now(), lineas, modo: 'mesa', nombre: '', hora: 'pronto', direccion: '', referencias: '' }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  // Pedido largo: la comanda no crece; se resume con «y N más · ver todo».
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.waitForTimeout(400);
  ok(await sinScroll(page) && await page.locator('#pd-ver-todo').isVisible() && await page.locator('.linea-lista:visible').count() < 12, '12 líneas: sin desplazamiento y con «ver todo»');
  await page.locator('#pd-ver-todo').click();
  ok(await page.locator('.linea-lista:not([hidden])').count() === 12 && await page.evaluate(() => document.querySelector('#lista').classList.contains('todo')), '«ver todo» muestra las 12 líneas en su capa');
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => !document.querySelector('#lista').classList.contains('todo') && document.querySelector('#lista').open), 'Escape cierra «ver todo» sin cerrar el panel');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('#entradas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="camaron-roca"]').click();
  await page.waitForSelector('#hoja[open]', { timeout: 5000 });
  ok(errores.length === 0, `con notas largas y emojis el menú sigue funcionando${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

// Pedido: QR de una mesa fuera del plano, ubicación del teléfono (permitida y negada),
// seguimiento al volver a abrir y "Nuevo pedido".
{
  console.log('\npedido: QR, ubicación y seguimiento');
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  const base = { v: 1, t: 0, modo: 'domicilio', nombre: 'Ana', hora: 'pronto', direccion: 'Calle 13 #45, Centro', referencias: '', lineas: [{ id: 'makizen-roll', n: 1 }] };
  const preparar = async (ctx, url) => {
    const page = await ctx.newPage();
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    await page.route(/basemaps\.cartocdn\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
    await page.route('https://wa.me/**', (r) => r.abort());
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate((l) => localStorage.setItem('makizen-lista', JSON.stringify({ ...l, t: Date.now() })), base);
    await page.reload({ waitUntil: 'networkidle' });
    return { page, errores };
  };

  // Mesa 40 desde el QR: no está en el plano, se acepta con aviso.
  let ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let { page, errores } = await preparar(ctx, `${BASE}/?src=qr-mesa-40`);
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.locator('#pd-seguir').click();
  await page.locator('label.modo:has(input[value="mesa"])').click();
  ok((await page.inputValue('#lista-mesa')) === '40' && await page.locator('#ayuda-mesa').isVisible(), 'mesa 40 del QR aceptada con aviso (fuera del plano)');
  await page.locator('#pd-seguir').click();
  await page.locator('label.pago:has(input[value="tarjeta"])').click();
  const t40 = new URL(await page.locator('#lista-enviar').getAttribute('href')).searchParams.get('text') ?? '';
  ok(t40.includes('En mesa: 40') && t40.includes('Pago: tarjeta (terminal en la mesa)'), 'mensaje con la mesa del QR');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();

  // Ubicación permitida.
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', permissions: ['geolocation'], geolocation: { latitude: 31.3201234, longitude: -113.5409876 } });
  ({ page, errores } = await preparar(ctx, BASE));
  ctx.on('page', (p) => p.close().catch(() => {}));
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.locator('#pd-seguir').click();
  await page.waitForSelector('#pd-mapa.leaflet-container', { timeout: 8000 }).catch(() => {});
  await page.locator('#pd-mi-ubicacion').click();
  await page.waitForSelector('#pd-mapa-estado.ok', { timeout: 5000 }).catch(() => {});
  ok(await page.locator('#pd-mapa .pd-icono-pin').count() === 1, '«Usar mi ubicación» coloca el pin');
  await page.locator('#pd-seguir').click();
  await page.locator('label.pago:has(input[value="efectivo"])').click();
  await page.locator('label.pd-chip:has(input[value="exacto"])').click();
  const tu = new URL(await page.locator('#lista-enviar').getAttribute('href')).searchParams.get('text') ?? '';
  ok(tu.includes('Ubicación: https://maps.google.com/?q=31.320123,-113.540988') && tu.includes('Pago: efectivo (exacto)'), 'mensaje con la ubicación del teléfono');
  await page.locator('#lista-enviar').click();
  await page.waitForSelector('[data-vista="seguimiento"]:not([hidden])', { timeout: 5000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.locator('#nav [data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  ok(await page.locator('[data-vista="seguimiento"]').isVisible(), 'al volver a abrir se ve el seguimiento');
  await page.locator('#pd-nuevo').click();
  await page.waitForTimeout(300);
  ok(await page.locator('#lista-vacia').isVisible() && (await page.evaluate(() => localStorage.getItem('makizen-pedido'))) === null, '«Nuevo pedido» limpia el seguimiento');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();

  // Ubicación negada: mensaje claro, el pedido sigue.
  ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  ({ page, errores } = await preparar(ctx, BASE));
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.locator('#pd-seguir').click();
  await page.waitForSelector('#pd-mapa.leaflet-container', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_ok, mal) => mal({ code: 1, message: 'denied', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 }); });
  await page.locator('#pd-mi-ubicacion').click();
  ok((await page.locator('#pd-mapa-estado').textContent())?.includes('permiso'), 'permiso de ubicación negado: lo explica');
  await page.locator('#pd-seguir').click();
  ok(await page.locator('[data-vista="3"]').isVisible(), 'sin ubicación igual se puede seguir (con movimiento reducido)');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

// Movimiento reducido: el detalle abre directo, sin capa líquida.
{
  console.log('\nmovimiento reducido');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('#entradas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="camaron-roca"]').click();
  ok(await page.locator('#hoja[open]').count() === 1 && (await page.locator('#morfo:not([hidden]), .vuelo').count()) === 0, 'abre sin animación de revelado');
  await ctx.close();
}
await browser.close();
console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
