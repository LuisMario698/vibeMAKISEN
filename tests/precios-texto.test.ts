import { describe, expect, it } from 'vitest';
import { precio, usd } from '../src/lib/precios';
import { escapar, jsonSeguro, normalizar } from '../src/lib/texto';

describe('precios', () => {
  it('MXN como en la cartilla', () => { expect(precio(1100)).toBe('$1,100'); expect(precio(90)).toBe('$90'); });
  it('USD de referencia redondeado y con mínimo 1', () => {
    expect(usd(170, 18.5)).toBe('≈ US$9');
    expect(usd(5, 18.5)).toBe('≈ US$1');
  });
});

describe('texto', () => {
  it('escapa HTML', () => { expect(escapar(`<img src=x onerror="a('b')">&`)).toBe('&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;&amp;'); });
  it('normaliza acentos', () => { expect(normalizar('  Camarón ROCA ')).toBe('camaron roca'); });
  it('JSON seguro no cierra el script', () => {
    const s = jsonSeguro({ a: '</script><script>x</script>' });
    expect(s).not.toContain('</script>');
    expect(JSON.parse(s)).toEqual({ a: '</script><script>x</script>' });
  });
});
