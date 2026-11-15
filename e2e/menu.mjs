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

const browser = await chromium.launch();
for (const [nombre, w, h] of TAMANOS) {
  console.log(`\n${nombre} (${w}×${h})`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.route('https://wa.me/**', (r) => r.abort());
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
  await page.waitForFunction(() => !document.querySelector('#hoja').open && !document.documentElement.classList.contains('bloqueo') && !document.querySelector('.liquido, .vuelo'), null, { timeout: 5000 });
  await page.waitForTimeout(500);
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-lista') ?? 'null'));
  ok(guardada?.v === 1 && guardada.lineas[0]?.n === 2 && guardada.lineas[0]?.op === 'camaron', 'lista guardada: 2 sopas de camarón');
  ok((await page.locator('.isla-lista .contador').textContent()) === '2', 'la isla cuenta 2');
  ok((await page.locator('.liquido, .vuelo').count()) === 0, 'no quedan capas de animación');
  ok(!(await page.evaluate(() => document.documentElement.classList.contains('bloqueo'))), 'la página no queda bloqueada');

  // Agotado: no se puede agregar.
  await page.locator('#bebidas-asiaticas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="hanagoi"]').click();
  await page.waitForSelector('#hoja[open]');
  ok(await page.locator('#hoja-agregar').isHidden(), 'agotado: sin botón de agregar');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#hoja').open && !document.documentElement.classList.contains('bloqueo') && !document.querySelector('.liquido, .vuelo'), null, { timeout: 5000 });
  await page.waitForTimeout(400);

  // Agregar con un toque una bebida de la lista.
  await page.locator('#cervezas').scrollIntoViewIfNeeded();
  await page.locator('[data-agregar]').first().click();
  await page.waitForTimeout(200);
  ok((await page.locator('.isla-lista .contador').textContent()) === '3', 'bebida agregada con un toque');

  // Mi lista: mesa 7 preseleccionada y enlace de WhatsApp.
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  await page.waitForTimeout(400);
  ok(await page.locator('input[name="modo"][value="mesa"]').isChecked(), 'modalidad en mesa por el QR');
  ok((await page.inputValue('#lista-mesa')) === '7', 'mesa 7 en el campo');
  let href = await page.locator('#lista-enviar').getAttribute('href');
  let texto = new URL(href).searchParams.get('text') ?? '';
  ok(href.startsWith('https://wa.me/526381560660?text='), 'enlace a wa.me del negocio');
  ok(texto.includes('En mesa: 7') && texto.includes('2 x Sopa Vietnamita de Pollo o Camarón (Camarón)') && texto.includes('Nota: sin cebolla') && texto.includes('Precio final lo confirma el restaurante.'), 'mensaje completo en español');

  // Para llevar sin nombre: errores visibles al intentar enviar.
  await page.locator('label.modo:has(input[value="llevar"])').click();
  await page.locator('#lista-enviar').click({ force: true });
  ok(await page.locator('#err-nombre').isVisible(), 'pide el nombre para llevar');
  await page.fill('#lista-nombre', 'Ana');
  href = await page.locator('#lista-enviar').getAttribute('href');
  texto = new URL(href).searchParams.get('text') ?? '';
  ok(texto.includes('Para llevar: Ana'), 'mensaje para llevar con nombre');
  // A domicilio: dirección obligatoria.
  await page.locator('label.modo:has(input[value="domicilio"])').click();
  await page.locator('#lista-enviar').click({ force: true });
  ok(await page.locator('#err-direccion').isVisible(), 'pide la dirección a domicilio');
  await page.fill('#lista-direccion', 'Calle 13 #45, Centro');
  href = await page.locator('#lista-enviar').getAttribute('href');
  ok((new URL(href).searchParams.get('text') ?? '').includes('Envío: lo confirma el restaurante.'), 'mensaje a domicilio con aviso de envío');
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'sin scroll horizontal con la lista abierta');
  await page.screenshot({ path: `e2e/captura-${nombre}-lista.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // Idioma: /en/, título y mensaje en inglés, USD visible.
  await page.locator('#nav [data-lang="en"]').click();
  await page.waitForTimeout(500);
  ok(new URL(page.url()).pathname === '/en/', 'la URL cambia a /en/');
  ok((await page.title()).startsWith('MAKIZEN Sushi & Seafood'), 'título en inglés');
  ok(await page.locator('.producto .text-humo:visible', { hasText: 'US$' }).first().isVisible(), 'USD visible');
  await page.locator('[data-abrir-lista]').first().click();
  await page.waitForSelector('#lista[open]');
  href = await page.locator('#lista-enviar').getAttribute('href');
  ok((new URL(href).searchParams.get('text') ?? '').includes('Delivery: Ana'), 'mensaje en inglés');
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
  await page.locator('#entradas').scrollIntoViewIfNeeded();
  await page.locator('[data-abrir="camaron-roca"]').click();
  await page.waitForSelector('#hoja[open]', { timeout: 5000 });
  ok(errores.length === 0, `con notas largas y emojis el menú sigue funcionando${errores.length ? ': ' + errores.join(' | ') : ''}`);
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
  ok(await page.locator('#hoja[open]').count() === 1 && (await page.locator('.liquido').count()) === 0, 'abre sin animación líquida');
  await ctx.close();
}
await browser.close();
console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
