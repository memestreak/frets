/**
 * Light / dark theme choice. "auto" follows the system; the other two set
 * `data-theme` on <html>, which fretwood.css keys its dark tokens off. With
 * nothing saved the theme is Light, whatever the system prefers.
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

/** The theme when nothing is saved and the link has no `?theme=`. */
export const DEFAULT_THEME: ThemeChoice = 'light';

const isTheme = (raw: unknown): raw is ThemeChoice =>
  raw === 'auto' || raw === 'light' || raw === 'dark';

/** The saved Appearance section; Light when missing or invalid. */
export const parseAppearance = (raw: unknown): Appearance => {
  const theme = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).theme : null;
  return { theme: isTheme(theme) ? theme : DEFAULT_THEME };
};

/** The choice currently applied to the document: no `data-theme` is Auto. */
export const currentTheme = (): ThemeChoice => {
  const attr = document.documentElement.getAttribute('data-theme');
  return attr === 'light' || attr === 'dark' ? attr : 'auto';
};

/**
 * Tints a phone's status bar to match: one `theme-color` meta for Light or
 * Dark, one per system theme for Auto. Made here and by the boot script, not
 * by Next's `viewport`, because React puts its own metas back on hydration.
 */
export function syncThemeColor(choice: ThemeChoice): void {
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  for (const scheme of choice === 'auto' ? (['light', 'dark'] as const) : [choice]) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = SURFACE_COLORS[scheme];
    if (choice === 'auto') meta.setAttribute('media', `(prefers-color-scheme: ${scheme})`);
    document.head.append(meta);
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
  syncThemeColor(choice);
}

/** The link parameter that picks a theme, e.g. `?theme=light`. */
export const THEME_PARAM = 'theme';

/**
 * Runs in <head> before first paint, so the page never flashes the wrong
 * theme. A `?theme=auto|light|dark` in the link is saved first, as if picked,
 * and dropped from the address: each PR preview is a new site with nothing
 * saved, so preview links carry it. Otherwise the saved choice, and with none
 * (or a bad one) Light. `<html>` already carries `data-theme="light"` from
 * `layout.tsx`, so the page is light even before this runs. The value is JSON,
 * as `saveJson` writes it. The status bar's colour waits for its metas, which
 * may come after this script. Kept in step with `parseAppearance`,
 * `applyTheme` and `syncThemeColor` by hand.
 */
export const THEME_BOOT_SCRIPT =
  `(function(){var k=${JSON.stringify(APPEARANCE_KEY)},n=${JSON.stringify(THEME_PARAM)},t=null;` +
  // The link's choice: applied even when it can't be saved (private mode).
  `try{var u=new URL(location.href),p=u.searchParams.get(n);` +
  `if(p==='auto'||p==='light'||p==='dark'){t=p;u.searchParams.delete(n);` +
  `history.replaceState(history.state,'',u.href);localStorage.setItem(k,JSON.stringify({theme:p}))}}catch(e){}` +
  // Otherwise the saved choice.
  `try{if(t===null){var a=JSON.parse(localStorage.getItem(k));t=a&&a.theme}}catch(e){}` +
  // Otherwise Light.
  `if(t!=='auto'&&t!=='light'&&t!=='dark')t=${JSON.stringify(DEFAULT_THEME)};` +
  `var r=document.documentElement;if(t==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',t);` +
  // The status bar's colour, as syncThemeColor makes it.
  `var c=${JSON.stringify(SURFACE_COLORS)},s=t==='auto'?['light','dark']:[t];` +
  `for(var i=0;i<s.length;i++){var m=document.createElement('meta');m.name='theme-color';m.content=c[s[i]];` +
  `if(t==='auto')m.setAttribute('media','(prefers-color-scheme: '+s[i]+')');document.head.appendChild(m)}})()`;
