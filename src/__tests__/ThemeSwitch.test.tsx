import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { APPEARANCE_KEY, THEME_BOOT_SCRIPT } from '@/lib/theme';

const root = document.documentElement;
const button = () => screen.getByRole('button', { name: /^Theme: / });

afterEach(() => {
  root.removeAttribute('data-theme');
  window.history.replaceState(null, '', '/');
  localStorage.clear();
});

describe('ThemeSwitch', () => {
  it('follows the system until a theme is picked', () => {
    render(<ThemeSwitch />);
    expect(button()).toHaveAccessibleName('Theme: Auto');
    expect(button()).toHaveAttribute('title', 'Theme: Auto. Click for Light.');
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('cycles Auto, Light, Dark and saves each pick', () => {
    render(<ThemeSwitch />);
    fireEvent.click(button());
    expect(root).toHaveAttribute('data-theme', 'light');
    expect(button()).toHaveAccessibleName('Theme: Light');
    fireEvent.click(button());
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'dark' });
    fireEvent.click(button());
    expect(root).not.toHaveAttribute('data-theme');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY)!)).toEqual({ theme: 'auto' });
  });

  it('shows the theme the boot script restored', () => {
    localStorage.setItem(APPEARANCE_KEY, JSON.stringify({ theme: 'light' }));
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).toHaveAttribute('data-theme', 'light');
    render(<ThemeSwitch />);
    expect(button()).toHaveAccessibleName('Theme: Light');
  });

  it('boot script ignores a bad saved value', () => {
    localStorage.setItem(APPEARANCE_KEY, 'not json');
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).not.toHaveAttribute('data-theme');
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
