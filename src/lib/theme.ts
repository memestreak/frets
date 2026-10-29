/**
 * Light / dark theme choice. "auto" follows the system; the other two set
 * `data-theme` on <html>, which fretwood.css keys its dark tokens off.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

/** General › Appearance: `{ theme }`. */
export const APPEARANCE_KEY = 'frets.general.appearance';

export interface Appearance {
  theme: ThemeChoice;
}

/**
 * `--surface` in each theme, for the places that can't read CSS tokens: the
 * web manifest and the `theme-color` meta that tints a phone's status bar.
 * Kept in step with fretwood.css (a test checks).
 */
export const SURFACE_COLORS = { light: '#f6f0e4', dark: '#1e1915' } as const;

export const parseTheme = (raw: unknown): ThemeChoice =>
  raw === 'light' || raw === 'dark' ? raw : 'auto';

/** The saved Appearance section; Auto when missing or invalid. */
export const parseAppearance = (raw: unknown): Appearance =>
  ({ theme: parseTheme(raw && typeof raw === 'object' ? (raw as Record<string, unknown>).theme : null) });

/** The choice currently applied to the document. */
export const currentTheme = (): ThemeChoice =>
  parseTheme(document.documentElement.getAttribute('data-theme'));

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

/**
 * Runs in <head> before first paint, so a saved Light or Dark never flashes
 * the other theme. The value is JSON, as `saveJson` writes it. Kept in step
 * with `parseAppearance` and `applyTheme` by hand.
 */
export const THEME_BOOT_SCRIPT =
  `(function(){try{var a=JSON.parse(localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})),t=a&&a.theme;` +
  `if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
