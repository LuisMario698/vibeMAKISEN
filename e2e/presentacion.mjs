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

// Registro dentro de la página: pasos de la banda, vistas de «Mi pedido» y folio del seguimiento.
const REGISTRO = () => {
  const r = (window.__demo = { pasos: [], vistas: [], folio: '', omitidos: [] });
  const warn = console.warn;
  console.warn = (...a) => { if (String(a[0]).startsWith('presentación')) r.omitidos.push(String(a[1])); warn.apply(console, a); };
  new MutationObserver(() => {
    const p = document.querySelector('.pz-banda')?.getAttribute('data-paso');
    if (p && r.pasos.at(-1) !== p) r.pasos.push(p);
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
    presentando: document.documentElement.classList.contains('presentando') || !!document.querySelector('.pz-banda, .pz-cursor'),
  }));
}

const browser = await chromium.launch();

/* ── Recorrido completo (acelerado) en español e inglés, teléfono y computadora ── */
for (const [idioma, ruta, w, h] of [['es', '/', 390, 844], ['es', '/', 1440, 900], ['en', '/en/', 390, 844], ['en', '/en/', 1280, 720]]) {
  console.log(`\nrecorrido ${idioma} ${w}×${h}`);
  const { ctx, page, errores, externos, antes } = await preparar(browser, w, h, ruta);
  await page.goto(`${BASE}${ruta}?demo=1&rapido=1`, { waitUntil: 'domcontentloaded' });
  ok((await page.evaluate(() => document.documentElement.lang)).startsWith(idioma), `idioma de la ruta (${idioma})`);
  await page.waitForSelector('.pz-banda', { timeout: 10_000 });
  ok(await page.evaluate(() => !document.querySelector('.pz-banda .pz-titulo')?.closest('[inert]')), 'la banda no queda inerte');
  await page.waitForSelector('dialog.pz-final[open]', { timeout: 90_000 }).catch(() => undefined);
  const reg = await page.evaluate(() => window.__demo);
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
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal');
  const botones = await page.locator('.pz-final-boton').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height));
  ok(botones.length === 2 && botones.every((x) => x >= 44), 'botones finales de ≥ 44 px');
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
  ok(idioma === 'en' ? /Browse the sections/i.test(t) : /Explora las secciones/i.test(t), `subtítulo en ${idioma}: «${t.replace(/\s+/g, ' ')}»`);
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
