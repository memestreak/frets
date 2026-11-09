import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import {
  APPEARANCE_KEY, SURFACE_COLORS, THEME_BOOT_SCRIPT, applyTheme, parseAppearance,
} from '@/lib/theme';

const root = document.documentElement;
const button = () => screen.getByRole('button', { name: /^Theme: / });
const boot = () => new Function(THEME_BOOT_SCRIPT)();

afterEach(() => {
  root.removeAttribute('data-theme');
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

describe('ThemeSwitch', () => {
  it('is Light with nothing saved, even when the system prefers dark', () => {
    // fretwood.css keys dark off the system only without data-theme, so Light
    // here holds whatever the system prefers.
    boot();
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull();
    render(<ThemeSwitch />);
    expect(button()).toHaveAccessibleName('Theme: Light');
    expect(button()).toHaveAttribute('title', 'Theme: Light. Click for Dark.');
  });

  it('cycles Light, Dark, Auto and saves each pick', () => {
    boot();
    render(<ThemeSwitch />);
    fireEvent.click(button());
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(button()).toHaveAccessibleName('Theme: Dark');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'dark' });
    fireEvent.click(button());
    expect(root).not.toHaveAttribute('data-theme');
    expect(button()).toHaveAccessibleName('Theme: Auto');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'auto' });
    fireEvent.click(button());
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'light' });
  });

  it('puts a saved Dark back when React has reset <html> (a hydration error)', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'dark' }));
    root.setAttribute('data-theme', 'light'); // as React renders it afresh
    render(<ThemeSwitch />);
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(button()).toHaveAccessibleName('Theme: Dark');
  });

  it('boot script keeps a saved Auto following the system', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'auto' }));
    root.setAttribute('data-theme', 'light'); // as layout.tsx renders it
    boot();
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('a missing or bad saved Appearance reads as Light', () => {
    expect(parseAppearance(null)).toEqual({ theme: 'light' });
    expect(parseAppearance({ theme: 'pink' })).toEqual({ theme: 'light' });
    expect(parseAppearance({ theme: 'auto' })).toEqual({ theme: 'auto' });
  });

  it("tints the status bar with the chosen theme's colour, or each system's for Auto", () => {
    const metas = () => [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')]
      .map(m => [m.getAttribute('media'), m.content]);
    const auto = [
      ['(prefers-color-scheme: light)', SURFACE_COLORS.light],
      ['(prefers-color-scheme: dark)', SURFACE_COLORS.dark],
    ];
    boot();
    expect(metas()).toEqual([[null, SURFACE_COLORS.light]]);
    applyTheme('dark');
    expect(metas()).toEqual([[null, SURFACE_COLORS.dark]]);
    applyTheme('auto');
    expect(metas()).toEqual(auto);
    // The boot script, on a fresh page, makes the same for a saved Auto.
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.remove());
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'auto' }));
    boot();
    expect(metas()).toEqual(auto);
  });

  it('boot script takes a bad saved value as Light', () => {
    localStorage.setItem(APPEARANCE_KEY, 'not json');
    boot();
    expect(root).toHaveAttribute('data-theme', 'light');
  });
  it('boot script saves and applies ?theme= from the link, then drops it', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'dark' }));
    window.history.replaceState(null, '', '/tab?theme=light&x=1#tabz=abc');
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'light' });
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe('/tab?x=1#tabz=abc');
  });

  it('boot script takes ?theme=auto as Auto, over a saved Dark', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'dark' }));
    window.history.replaceState(null, '', '/?theme=auto');
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).not.toHaveAttribute('data-theme');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'auto' });
    expect(window.location.search).toBe('');
  });

  it('boot script ignores and keeps an unknown ?theme=', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'dark' }));
    window.history.replaceState(null, '', '/?theme=pink');
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(window.location.search).toBe('?theme=pink');
  });

  it("boot script applies ?theme= even when it can't be saved", () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    window.history.replaceState(null, '', '/?theme=light');
    new Function(THEME_BOOT_SCRIPT)();
    setItem.mockRestore();
    expect(root).toHaveAttribute('data-theme', 'light');
  });
});
