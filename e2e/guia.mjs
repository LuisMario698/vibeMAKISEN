// Guía del comensal («pistas en el momento») de punta a punta con Playwright contra `astro preview`.
// Uso: npm run build && (npx astro preview --port 4371 &) && BASE=http://127.0.0.1:4371 node e2e/guia.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(require.resolve('playwright', { paths: ['/usr/local/lib/node_modules', '/usr/lib/node_modules'] })); }
const { chromium } = pw;

const BASE = process.env.BASE ?? 'http://localhost:4371';
let fallas = 0;
const ok = (cond, msg) => { console.log(`${cond ? '  ✓' : '  ✗'} ${msg}`); if (!cond) fallas++; };
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch();
async function contexto(o = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 664 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'es-MX', serviceWorkers: 'block', ...o });
  const page = await ctx.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.route('https://wa.me/**', (r) => r.abort());
  // Vigía: cuántas pistas hubo a la vez como máximo, cuáles salieron (en orden) y si alguna
  // estuvo a la vista a la vez que el aviso «Agregado · Ver pedido», en esta carga.
  await ctx.addInitScript(() => {
    window.__guia = { max: 0, salieron: [], tiempos: [], encima: [] };
    // Se mira en el cuadro siguiente a cada cambio: lo que de verdad llega a pintarse.
    let pendiente = false;
    const mirar = () => {
      pendiente = false;
      const gp = document.querySelectorAll('.gp');
      window.__guia.max = Math.max(window.__guia.max, gp.length);
      gp.forEach((g) => { if (!g.dataset.contada) { g.dataset.contada = '1'; window.__guia.salieron.push(g.dataset.pista); window.__guia.tiempos.push(performance.now()); } });
      const aviso = document.getElementById('aviso-agregado');
      const vivas = [...gp].filter((g) => !g.classList.contains('sale'));
      if (aviso && !aviso.hidden && vivas.length) window.__guia.encima.push(vivas.map((g) => g.dataset.pista).join(','));
    };
    new MutationObserver(() => { if (!pendiente) { pendiente = true; requestAnimationFrame(mirar); } }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'class'] });
  });
  return { ctx, page, errores };
}
const pista = (page, id, ms = 9000) => page.waitForSelector(`.gp[data-pista="${id}"]`, { timeout: ms }).then(() => true, () => false);
const sinPistas = (page, ms = 9000) => page.waitForFunction(() => !document.querySelector('.gp'), null, { timeout: ms }).then(() => true, () => false);
const vigia = (page) => page.evaluate(() => window.__guia);
const vistas = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('makizen-guia') ?? 'null'));
const irA = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); }, sel);
// La guía llega con carga diferida (tras la intro y con el navegador libre): sus estilos entran con
// su paquete, como un <style id="guia-estilos"> (nunca como hoja enlazada en el HTML).
const guiaCargada = (page) => page.waitForFunction(() => !!document.getElementById('guia-estilos'), null, { timeout: 8000 }).then(() => true, () => false);
/** ¿Hay alguna regla de la guía en las hojas del documento? (antes de cargarla debe ser que no). */
const reglasGuia = (page) => page.evaluate(() => [...document.styleSheets].some((h) => { try { return [...h.cssRules].some((r) => /\.gp-enso|\.cp-panel/.test(r.cssText)); } catch { return false; } }));
const sinScroll = (page) => page.evaluate(() => [...document.querySelectorAll('#lista .lista-scroll')].every((e) => e.scrollHeight <= e.clientHeight + 1));

/* ── 1 · Recorrido completo en el teléfono, llegando por el QR de la mesa 7 ── */
console.log('\nteléfono 390×664 · QR de la mesa 7');
{
  const { ctx, page, errores } = await contexto();
  const pedidos = [];
  page.on('request', (q) => pedidos.push(q.url()));
  await page.goto(`${BASE}/?src=qr-mesa-7`, { waitUntil: 'commit' });
  await page.waitForLoadState('domcontentloaded');
  ok(await page.evaluate(() => !document.querySelector('link[rel="stylesheet"][href*="guia"]')), 'el HTML no enlaza la hoja de la guía (no bloquea el render)');
  ok(!(await page.evaluate(() => !!document.getElementById('guia-estilos'))) && !(await reglasGuia(page)), 'al cargar no hay reglas de la guía en ninguna hoja');
  await page.waitForLoadState('networkidle');
  ok(await pista(page, 'bienvenida'), 'bienvenida de mesa al cargar');
  ok(await guiaCargada(page) && await reglasGuia(page) && pedidos.some((u) => /\/_astro\/guia\.[^/]*\.js/.test(u)), 'los estilos llegan con el paquete aparte de la guía');
  // No tapa el logo: va bajo la marca, sobre la fila del estado.
  const sitio = await page.evaluate(() => {
    const g = document.querySelector('.gp-bienvenida').getBoundingClientRect();
    const logo = document.querySelector('#inicio .marca-hero').getBoundingClientRect();
    return { libre: g.top >= logo.bottom, dentro: g.bottom <= innerHeight };
  });
  ok(sitio.libre && sitio.dentro, 'la bienvenida no tapa el logo de la portada');
  const bienvenida = await page.locator('.gp-bienvenida').innerText();
  ok(/MESA 7/i.test(bienvenida) && bienvenida.includes('Pide desde aquí y te lo llevamos'), 'dice «Mesa 7 · Pide desde aquí y te lo llevamos»');
  ok(await page.evaluate(() => document.activeElement === document.body), 'no roba el foco');
  await espera(400);
  ok((await page.locator('#guia-anuncio').textContent())?.includes('Mesa 7'), 'se anuncia en la región viva cortés');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.gp')).position === 'fixed' && document.querySelector('.gp').getAttribute('aria-hidden') === 'true'), 'no es modal ni duplica la lectura');
  ok(await sinPistas(page, 8000), 'se va sola');
  ok(await page.locator('.gc').count() === 1 && (await vistas(page))?.vistas?.camaron === undefined, 'la sugerencia no cuenta como vista hasta que asoma');

  // Sugerencia del Camarón Roca, en la página (no flota encima de nada).
  ok(await page.locator('.gc').count() === 1, 'sugerencia «¿Primera vez? Prueba el Camarón Roca» al final de la portada');
  ok((await page.locator('.gc-titulo').innerText()).includes('Camarón Roca') && (await page.locator('.gc-precio').innerText()).includes('$210'), 'con el platillo real y su precio');

  // Isla: pista anclada a la píldora, con el gesto de deslizar, sin tapar la píldora.
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  ok(await pista(page, 'isla'), 'pista de la isla al aparecer');
  const geo = await page.evaluate(() => {
    const c = document.querySelector('.gp').getBoundingClientRect();
    const p = document.querySelector('.isla-pildora').getBoundingClientRect();
    return { noTapa: c.bottom <= p.top, dentro: c.left >= 0 && c.right <= innerWidth, gesto: !!document.querySelector('.gp-gesto') };
  });
  ok(geo.noTapa && geo.dentro, 'la pista queda sobre la píldora, sin taparla y dentro de la pantalla');
  ok(geo.gesto, 'con el gesto de deslizar dibujado sobre la píldora');
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.gp')).pointerEvents === 'none'), 'la tarjeta no capta toques');
  // No intercepta: tocar la píldora con la pista a la vista abre las secciones (y la pista se va).
  await page.locator('.isla-pildora').click();
  ok(await page.locator('#isla-panel.on').count() === 1, 'la píldora sigue tocable con la pista a la vista');
  ok(await sinPistas(page, 1500), 'usar la función retira la pista');
  await page.keyboard.press('Escape');
  await espera(500);

  // Agregar: al ver las tarjetas de la carta.
  await irA(page, '#entradas');
  ok(await pista(page, 'agregar'), 'pista de agregar al ver tarjetas de platillos');
  const tapa = await page.evaluate(() => {
    const c = document.querySelector('.gp').getBoundingClientRect();
    const a = [...document.querySelectorAll('#menu article.producto')].find((x) => { const r = x.getBoundingClientRect(); return r.top >= 76 && r.bottom <= innerHeight - 150; })?.getBoundingClientRect();
    return a ? c.top >= a.bottom : false;
  });
  ok(tapa, 'no tapa la tarjeta que explica');
  await page.keyboard.press('Escape');
  ok(await sinPistas(page, 1000), 'Escape la descarta');

  // Buscar: tras pasar por dos secciones.
  for (const id of ['#tostadas-aguachiles', '#arroces']) { await irA(page, id); await espera(500); }
  ok(await pista(page, 'busqueda'), 'pista de buscar tras recorrer dos secciones');
  ok((await page.locator('.gp').innerText()).includes('Sin picante'), 'menciona los filtros');
  await sinPistas(page);
  await page.locator('.isla-lupa').click();
  await espera(150);
  ok(await page.locator('.isla-filtros.guia-filtros').count() === 1, 'la primera búsqueda realza los filtros');
  await page.keyboard.press('Escape');
  await espera(400);

  // Camarón Roca en un toque → contador 1 → pista del pedido (menciona la mesa).
  await page.locator('.gc').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('.gc.visto'), null, { timeout: 3000 }).catch(() => {});
  ok(typeof (await vistas(page))?.vistas?.camaron === 'number', 'la sugerencia se da por vista al asomar');
  await page.locator('.gc-agregar').click();
  await page.waitForFunction(() => document.querySelector('#nav .nav-contador')?.textContent === '1', null, { timeout: 3000 }).catch(() => {});
  ok((await page.locator('#nav .nav-contador').textContent()) === '1', '«Prueba el Camarón Roca» agrega al carrito (contador 1)');
  const linea = await page.evaluate(() => JSON.parse(localStorage.getItem('makizen-lista') ?? 'null')?.lineas?.[0]?.id);
  ok(linea === 'camaron-roca', 'la línea guardada es el Camarón Roca');
  ok(await pista(page, 'pedido', 9000), 'pista del pedido tras el primer platillo (al terminar el vuelo y el aviso)');
  ok(await page.evaluate(() => document.querySelector('#aviso-agregado').hidden), 'no se encima con el aviso «Agregado»');
  ok((await vigia(page)).encima.length === 0, 'desde la sugerencia no sale el aviso flotante: la tarjeta confirma en su sitio');
  ok((await page.locator('.gp').innerText()).includes('mesa 7'), 'dice que el pedido llega a su mesa');
  ok(await page.waitForSelector('.gc[data-estado="agregado"] .gc-ver', { timeout: 3000 }).then(() => true, () => false), 'la sugerencia queda como «Ver pedido»');
  await sinPistas(page);

  // Mi pedido: la línea de los tres pasos, sin desplazamiento.
  await page.locator('#nav [data-abrir-lista]').click();
  await page.waitForSelector('#lista[open]');
  await espera(500);
  ok(await page.locator('#pd-guia-pasos').isVisible(), 'la primera vez, «Tres pasos y se envía por WhatsApp» en la comanda');
  ok(await sinScroll(page), 'el panel sigue sin desplazamiento');
  await page.keyboard.press('Escape');
  await espera(400);

  const v = await vigia(page);
  ok(v.max <= 1, `nunca dos pistas a la vez (máximo ${v.max})`);
  ok(v.encima.length === 0, `nunca una pista a la vista con el aviso «Agregado» (${v.encima.join(' | ') || 'ninguna'})`);
  ok(['bienvenida', 'isla', 'agregar', 'busqueda', 'pedido'].every((id) => v.salieron.filter((x) => x === id).length === 1), `cada pista salió una vez (${v.salieron.join(', ')})`);
  const e = await vistas(page);
  ok(e?.v === 1 && ['bienvenida', 'isla', 'agregar', 'busqueda', 'pedido', 'filtros', 'pasos', 'camaron'].every((k) => typeof e.vistas[k] === 'number') && e.mesa === 7, 'estado guardado con versión, lo visto y la mesa');

  // Recargar: nada vuelve (ni la bienvenida de la misma mesa ni la sugerencia).
  await page.goto(`${BASE}/?src=qr-mesa-7`, { waitUntil: 'networkidle' });
  await espera(2500);
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  await espera(1500);
  await irA(page, '#entradas');
  await espera(1500);
  ok((await vigia(page)).salieron.length === 0, 'tras recargar no vuelve ninguna pista');
  ok(await page.locator('.gc').count() === 0, 'ni la sugerencia del Camarón Roca');
  await page.locator('#nav [data-abrir-lista]').click();
  await page.waitForSelector('#lista[open]');
  ok(await page.locator('#pd-guia-pasos').isHidden(), 'ni la línea de los pasos');
  await page.keyboard.press('Escape');
  await espera(400);

  // «¿Cómo pido?»: abre la hoja con los 4 pasos y «Ver las pistas otra vez» reinicia la guía.
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  await espera(300);
  await page.locator('#menu [data-como-pido]').click();
  await page.waitForSelector('#como-pido[open]');
  ok(await page.locator('#como-pido .cp-paso').count() === 4, '«¿Cómo pido?» abre la hoja con los 4 pasos');
  ok(await page.evaluate(() => document.activeElement?.id === 'cp-titulo'), 'el foco entra a la hoja (la abrió la persona)');
  await page.locator('[data-cp-reiniciar]').click();
  await page.waitForFunction(() => !document.querySelector('#como-pido').open, null, { timeout: 2000 });
  ok(JSON.stringify(Object.keys((await vistas(page))?.vistas ?? { x: 1 })) === '["bienvenida"]', '«Ver las pistas otra vez» borra lo visto (salvo la bienvenida de la mesa)');
  ok(await pista(page, 'isla', 6000), 'y las pistas vuelven a salir');
  // Con platillos ya en el carrito, su pista no se adelanta: primero lo que se tiene delante.
  ok((await vigia(page)).salieron[0] === 'isla', 'tras reiniciar sale primero la de la isla (el carrito, al final)');
  ok(errores.length === 0, `sin errores en consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);
  await ctx.close();
}

/* ── 1b · Buscar no sale encima del aviso «Agregado»: tras el primer platillo va primero la del pedido ── */
console.log('\n375×667 EN · aviso «Added» y pista de buscar');
{
  const { ctx, page, errores } = await contexto({ viewport: { width: 375, height: 667 }, locale: 'en-US' });
  // Ya vio la isla y la de agregar: la de buscar está a punto de tocar (en cuanto pase dos secciones).
  await page.goto(`${BASE}/en/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.setItem('makizen-guia', JSON.stringify({ v: 1, vistas: { isla: Date.now(), agregar: Date.now(), camaron: Date.now(), hoja: Date.now() } })));
  await page.reload({ waitUntil: 'networkidle' });
  await guiaCargada(page);
  // Llega a las cervezas (una sección), agrega una con su «+» y sigue recorriendo: la de buscar
  // queda pedida justo cuando sale el aviso «Added · View order».
  await irA(page, '#cervezas');
  await espera(500);
  const tAgrega = await page.evaluate(() => performance.now());
  await page.locator('#cervezas [data-agregar]').first().click();
  await page.waitForFunction(() => !document.getElementById('aviso-agregado').hidden, null, { timeout: 4000 }).catch(() => {});
  ok(await page.evaluate(() => !document.getElementById('aviso-agregado').hidden), 'sale el aviso «Added · View order»');
  for (const id of ['#arroces', '#tostadas-aguachiles', '#cervezas']) { await irA(page, id); await espera(300); }
  ok(await pista(page, 'pedido', 9000), 'después sale la pista del pedido');
  await sinPistas(page);
  await pista(page, 'busqueda', 6000);
  await sinPistas(page);
  const v = await vigia(page);
  ok(v.encima.length === 0, `ninguna pista encima del aviso (${v.encima.join(' | ') || 'ninguna'})`);
  const tras = v.salieron.filter((_, i) => v.tiempos[i] > tAgrega);
  ok(tras[0] === 'pedido', `tras agregar, la primera pista es la del pedido (${tras.join(', ')})`);
  ok(tras.includes('busqueda'), 'y la de buscar llega después');
  ok(errores.length === 0, `sin errores en consola${errores.length ? `: ${errores.join(' | ')}` : ''}`);
  await ctx.close();
}

/* ── 1c · Con ratón: «Click…», y la pista no se queda con el clic de lo que tapa ── */
console.log('\n1440×900 con ratón');
{
  const { ctx, page } = await contexto({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  ok(await pista(page, 'isla'), 'pista de la isla');
  ok((await page.locator('.gp').innerText()).startsWith('Haz clic'), `dice «Haz clic…» (${(await page.locator('.gp .gp-titulo').innerText()).trim()})`);
  ok(!/[⇆]|Desliza|Arrastra/.test(await page.locator('#guia-anuncio').textContent()), 'el anuncio no lleva flechas ni gestos');
  // Un clic justo sobre la tarjeta llega a lo que hay debajo y la retira a la vez.
  const r = await page.locator('.gp').boundingBox();
  const debajo = await page.evaluate(({ x, y }) => { const g = document.querySelector('.gp'); const e = document.elementsFromPoint(x, y).find((n) => !g.contains(n)); return e?.tagName ?? ''; }, { x: r.x + r.width / 2, y: r.y + r.height / 2 });
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  ok(await sinPistas(page, 1200), `el clic sobre la pista la retira (debajo: ${debajo})`);
  await ctx.close();
}

/* ── 2 · En inglés los textos cambian; la isla también abre «How to order?» ── */
console.log('\ninglés');
{
  const { ctx, page } = await contexto({ locale: 'en-US' });
  await page.goto(`${BASE}/en/?src=qr-mesa-7`, { waitUntil: 'networkidle' });
  ok(await pista(page, 'bienvenida'), 'bienvenida');
  const t = await page.locator('.gp-bienvenida').innerText();
  ok(/TABLE 7/i.test(t) && t.includes("Order from here and we'll bring it to you"), 'Table 7 · Order from here…');
  await sinPistas(page);
  ok((await page.locator('.gc-titulo').innerText()).includes('Try the Rock Shrimp'), 'Try the Rock Shrimp');
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  ok(await pista(page, 'isla'), 'pista de la isla');
  ok((await page.locator('.gp').innerText()).includes('Tap to see every section'), 'Tap to see every section');
  await sinPistas(page);
  await page.locator('.isla-pildora').click();
  await page.locator('#isla-panel [data-como-pido]').click();
  await page.waitForSelector('#como-pido[open]');
  ok((await page.locator('#cp-titulo').innerText()).includes('How to order?'), '«How to order?» desde el selector de secciones');
  ok(await page.locator('#isla-panel.on').count() === 0, 'el selector se cierra al abrir la hoja');
  await ctx.close();
}

/* ── 3 · Mi pedido con la línea de los pasos: sin desplazamiento en 320×568, 390×664 y 1440×900 ── */
console.log('\nMi pedido sin desplazamiento con la línea de los pasos');
for (const [w, h] of [[320, 568], [390, 664], [1440, 900]]) {
  const { ctx, page } = await contexto({ viewport: { width: w, height: h }, isMobile: w < 1000, hasTouch: w < 1000 });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await espera(1200);
  // Tres líneas, como alguien que ya agregó (la guía aún no vio los pasos).
  await page.evaluate(() => localStorage.setItem('makizen-lista', JSON.stringify({ v: 1, t: Date.now(), modo: 'mesa', lineas: [{ id: 'camaron-roca', n: 1 }, { id: 'makizen-roll', n: 2 }, { id: 'aguachile-mixto', n: 1 }] })));
  await page.reload({ waitUntil: 'networkidle' });
  await guiaCargada(page);
  await page.locator('#nav [data-abrir-lista]').click();
  await page.waitForSelector('#lista[open]');
  await espera(600);
  const visible = await page.locator('#pd-guia-pasos').isVisible();
  ok(visible && await sinScroll(page), `${w}×${h}: línea visible y panel sin scroll`);
  await ctx.close();
}

/* ── 4 · Apagada: modo presentación (?demo=1) y ?guia=0 (que dura la sesión) ── */
console.log('\napagada');
for (const q of ['?demo=1', '?guia=0']) {
  const { ctx, page } = await contexto();
  await page.goto(`${BASE}/${q}`, { waitUntil: 'networkidle' });
  await espera(2000);
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  await espera(2000);
  ok((await vigia(page)).salieron.length === 0 && await page.locator('.gc').count() === 0, `${q}: sin pistas ni sugerencia`);
  if (q === '?guia=0') {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await espera(2000);
    await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
    await espera(2000);
    ok((await vigia(page)).salieron.length === 0, '?guia=0 se recuerda en la sesión');
    // «¿Cómo pido?» sigue disponible.
    await page.locator('#menu [data-como-pido]').click();
    ok(await page.waitForSelector('#como-pido[open]', { timeout: 3000 }).then(() => true, () => false), '«¿Cómo pido?» funciona con la guía apagada');
  }
  await ctx.close();
}

/* ── 5 · Sin localStorage: la guía funciona y no se repite en la sesión ── */
console.log('\nsin localStorage');
{
  const { ctx, page, errores } = await contexto();
  await ctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); } }); });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  ok(await pista(page, 'isla'), 'la pista sale aunque no haya localStorage');
  await sinPistas(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  await espera(2500);
  ok(!(await vigia(page)).salieron.includes('isla'), 'y no se repite en la misma sesión');
  ok(errores.filter((x) => !/bloqueado/.test(x)).length === 0, 'sin errores propios');
  await ctx.close();
}

/* ── 6 · Movimiento reducido: solo fundidos ── */
console.log('\nmovimiento reducido');
{
  const { ctx, page } = await contexto({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.querySelector('#menu').scrollIntoView({ block: 'start' }));
  ok(await pista(page, 'isla'), 'pista de la isla');
  const anim = await page.evaluate(() => getComputedStyle(document.querySelector('.gp')).animationName);
  ok(anim === 'gp-funde', `entra con un fundido, sin desplazarse (${anim})`);
  ok(await page.evaluate(() => getComputedStyle(document.querySelector('.gp-gesto-punto')).display === 'none'), 'sin la yema que se desliza');
  await ctx.close();
}

await browser.close();
console.log(fallas ? `\n${fallas} prueba(s) fallaron` : '\nTodo bien');
process.exit(fallas ? 1 : 0);
