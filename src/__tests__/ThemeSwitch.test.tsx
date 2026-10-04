import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { THEME_BOOT_SCRIPT, THEME_KEY } from '@/lib/theme';

const root = document.documentElement;
const pressed = () => screen
  .getAllByRole('button')
  .find(b => b.getAttribute('aria-pressed') === 'true')?.textContent;

afterEach(() => {
  root.removeAttribute('data-theme');
  localStorage.clear();
});

describe('ThemeSwitch', () => {
  it('follows the system until a theme is picked', () => {
    render(<ThemeSwitch />);
    expect(pressed()).toBe('Auto');
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('applies and saves the pick', () => {
    render(<ThemeSwitch />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(root).toHaveAttribute('data-theme', 'dark');
    expect(JSON.parse(localStorage.getItem(THEME_KEY)!)).toBe('dark');
    expect(pressed()).toBe('Dark');
    fireEvent.click(screen.getByRole('button', { name: 'Auto' }));
    expect(root).not.toHaveAttribute('data-theme');
  });

  it('shows the theme the boot script restored', () => {
    localStorage.setItem(THEME_KEY, JSON.stringify('light'));
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).toHaveAttribute('data-theme', 'light');
    render(<ThemeSwitch />);
    expect(pressed()).toBe('Light');
  });

  it('boot script ignores a bad saved value', () => {
    localStorage.setItem(THEME_KEY, 'not json');
    new Function(THEME_BOOT_SCRIPT)();
    expect(root).not.toHaveAttribute('data-theme');
  });
});
