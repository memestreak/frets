import { existsSync, readFileSync } from 'node:fs';
import manifest from '@/app/manifest';
import { SURFACE_COLORS } from '@/lib/theme';

describe('web manifest', () => {
  it('points at icons that exist in public/', () => {
    for (const icon of manifest().icons ?? []) {
      expect(existsSync(`public${icon.src}`), icon.src).toBe(true);
    }
  });

  it('offers a maskable icon for Android', () => {
    expect(manifest().icons?.some(i => i.purpose === 'maskable')).toBe(true);
  });
});

describe('SURFACE_COLORS', () => {
  it('matches --surface in fretwood.css', () => {
    const css = readFileSync('src/styles/fretwood.css', 'utf8');
    expect(css).toContain(`--surface: ${SURFACE_COLORS.light};`);
    expect(css).toContain(`--surface: ${SURFACE_COLORS.dark};`);
  });
});
