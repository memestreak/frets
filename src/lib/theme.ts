/**
 * Light / dark theme choice. "auto" follows the system; the other two set
 * `data-theme` on <html>, which fretwood.css keys its dark tokens off.
 */
export type ThemeChoice = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'frets.theme';

export const parseTheme = (raw: unknown): ThemeChoice =>
  raw === 'light' || raw === 'dark' ? raw : 'auto';

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
 * with `parseTheme` and `applyTheme` by hand.
 */
export const THEME_BOOT_SCRIPT =
  `(function(){try{var t=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_KEY)}));` +
  `if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}})()`;
