import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeSwitch } from '@/components/ThemeSwitch';
import { APPEARANCE_KEY, THEME_BOOT_SCRIPT } from '@/lib/theme';

const root = document.documentElement;
const button = () => screen.getByRole('button', { name: /^Theme: / });

afterEach(() => {
  root.removeAttribute('data-theme');
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
});
