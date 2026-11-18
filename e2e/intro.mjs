// Prueba de la animación de inicio con Playwright contra `astro preview` (o BASE=https://…).
// Las pruebas automáticas no ven la intro (navigator.webdriver), salvo con ?intro=1.
// Uso: npm run build && (npx astro preview --port 4331 &) && BASE=http://localhost:4331 node e2e/intro.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules', '/usr/lib/node_modules', '/opt/node-tools/node_modules'] })); }
const { chromium } = pw;

const BASE = process.env.BASE ?? 'http://localhost:4329';
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const activa = (page) => page.evaluate(() => document.documentElement.classList.contains('intro'));
const capa = (page) => page.evaluate(() => {
  const c = document.getElementById('intro');
  return !!c && getComputedStyle(c).display !== 'none' && getComputedStyle(c).visibility !== 'hidden';
});
const titularListo = (page) => page.evaluate(() => {
  const l = [...document.querySelectorAll('#inicio .titular-vista:not([hidden]) .letra')].filter((x) => x.offsetParent);
  return l.length > 0 && l.every((x) => getComputedStyle(x).transform === 'none' || getComputedStyle(x).transform === 'matrix(1, 0, 0, 1, 0, 0)');
});

const browser = await chromium.launch();
// La guía del comensal tiene su propia prueba (e2e/guia.mjs). Aquí va apagada en la sesión,
// como con ?guia=0, para que sus pistas y su sugerencia no cambien lo que se mide.
const nuevoContexto = browser.newContext.bind(browser);
browser.newContext = async (o) => {
  const c = await nuevoContexto(o);
  await c.addInitScript(() => { try { sessionStorage.setItem('makizen-guia-off', '1'); } catch { /* sin almacenamiento */ } });
  return c;
};
async function contexto(opciones = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-MX', serviceWorkers: 'block', ...opciones });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  return { ctx, page, errores };
}

console.log('\nsin ?intro=1 (prueba automática)');
{
  const { ctx, page, errores } = await contexto();
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  ok(!(await activa(page)) && !(await capa(page)), 'no se muestra la intro');
  await page.waitForTimeout(400);
  ok((await page.locator('#intro').count()) === 0, 'la capa se quita del DOM');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\n?intro=1: aparece y desaparece sola; la segunda carga ya no la muestra');
{
  const { ctx, page, errores } = await contexto();
  await page.goto(`${BASE}/?intro=1`, { waitUntil: 'domcontentloaded' });
  const t0 = Date.now();
  ok(await activa(page), 'html.intro activa');
  ok(await capa(page), 'la capa se ve');
  ok(await page.locator('#intro').getAttribute('aria-hidden') === 'true', 'la capa es decorativa (aria-hidden)');
  ok(await page.evaluate(() => sessionStorage.getItem('makizen-intro')) === '1', 'queda marcada en la sesión');
  await page.waitForFunction(() => !document.documentElement.classList.contains('intro'), null, { timeout: 4000 });
  const dura = Date.now() - t0;
  ok(dura <= 2900, `termina sola (${dura} ms desde DOMContentLoaded; la animación dura 2.36 s)`);
  await page.waitForTimeout(300);
  ok((await page.locator('#intro').count()) === 0, 'la capa se quita del DOM');
  await page.waitForTimeout(1500);
  ok(await titularListo(page), 'el titular de la portada termina de entrar');
  ok(await page.locator('#inicio .boton-oro').isVisible(), '«Ver el menú» visible');
  await page.goto(`${BASE}/?intro=1`, { waitUntil: 'domcontentloaded' });
  ok(!(await activa(page)) && !(await capa(page)), 'segunda carga en la misma sesión: no se muestra');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\n?intro=1: se salta con un clic sin activar lo que hay debajo');
{
  const { ctx, page, errores } = await contexto();
  await page.goto(`${BASE}/?intro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  ok(await capa(page), 'la capa se ve');
  // Clic justo donde queda «Ver el menú»: no debe saltar al menú.
  const caja = await page.locator('#inicio .boton-oro').boundingBox();
  const t0 = Date.now();
  await page.mouse.click(caja.x + caja.width / 2, caja.y + caja.height / 2);
  await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 1500 });
  ok(Date.now() - t0 < 1000, `se quita al instante (${Date.now() - t0} ms)`);
  ok(!(await activa(page)), 'html.intro desactivada');
  ok(!page.url().includes('#menu') && (await page.evaluate(() => scrollY)) < 50, 'el clic no activó «Ver el menú»');
  await page.waitForTimeout(1800);
  ok(await titularListo(page), 'el titular entra después de saltar');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\n?intro=1: se salta con una tecla (en inglés)');
{
  const { ctx, page, errores } = await contexto({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
  await page.goto(`${BASE}/en/?intro=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  ok(await capa(page), 'la capa se ve en /en/');
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => !document.getElementById('intro'), null, { timeout: 1500 });
  ok(true, 'Tab la salta');
  ok(await page.evaluate(() => document.activeElement && document.activeElement !== document.body), 'el foco avanza con normalidad');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\n?intro=1 con movimiento reducido: no estorba');
{
  const { ctx, page, errores } = await contexto({ reducedMotion: 'reduce', viewport: { width: 820, height: 1180 } });
  await page.goto(`${BASE}/?intro=1`, { waitUntil: 'domcontentloaded' });
  ok(!(await activa(page)) && !(await capa(page)), 'no se muestra la intro');
  await page.waitForTimeout(300);
  ok(await titularListo(page), 'el titular está quieto y completo');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cinta-pista')).animationName === 'none'), 'la cinta de especialidades no se mueve');
  await page.locator('#inicio .boton-oro').click();
  await page.waitForTimeout(300);
  ok(page.url().includes('#menu') || (await page.evaluate(() => scrollY)) > 300, '«Ver el menú» responde de inmediato');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\nportada: botón para pausar el movimiento continuo');
{
  const { ctx, page, errores } = await contexto();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  const boton = page.locator('#portada-pausa');
  ok(await boton.isVisible(), 'botón de pausa visible');
  const caja = await boton.boundingBox();
  ok(caja.width >= 44 && caja.height >= 44, 'objetivo táctil de 44 px');
  ok(await boton.getAttribute('aria-pressed') === 'false', 'empieza en movimiento (aria-pressed=false)');
  await boton.click();
  ok(await boton.getAttribute('aria-pressed') === 'true', 'al tocarlo: aria-pressed=true');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cinta-pista')).animationPlayState === 'paused'), 'la cinta se detiene');
  await page.reload({ waitUntil: 'networkidle' });
  ok(await boton.getAttribute('aria-pressed') === 'true', 'la preferencia se recuerda');
  await page.waitForTimeout(1600);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('#inicio .oro')).clipPath.includes('-')), '«Sinaloa.» termina de pintarse aunque esté en pausa');
  await boton.click();
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.cinta-pista')).animationPlayState === 'running'), 'vuelve a moverse');
  ok(errores.length === 0, `sin errores de consola${errores.length ? ': ' + errores.join(' | ') : ''}`);
  await ctx.close();
}

console.log('\nportada: accesible y sin desbordes');
for (const [w, h] of [[390, 844], [820, 1180], [1440, 900]]) {
  const { ctx, page } = await contexto({ viewport: { width: w, height: h } });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${w}×${h}: sin scroll horizontal`);
  const nombre = await page.evaluate(() => {
    const h1 = document.getElementById('t-inicio');
    return [...h1.querySelectorAll('.sr-only')].filter((s) => getComputedStyle(s).display !== 'none').map((s) => s.textContent).join('');
  });
  ok(nombre === 'Sushi & mariscos estilo Sinaloa.', `${w}×${h}: el titular se lee entero («${nombre}»)`);
  await ctx.close();
}

await browser.close();
console.log(fallas ? `\n${fallas} falla(s)` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
