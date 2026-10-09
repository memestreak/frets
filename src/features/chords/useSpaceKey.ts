import { useEffect } from 'react';

/**
 * Space anywhere on the page calls `onPress`, in place of what the key
 * would otherwise do: it doesn't scroll the page, a focused button (say,
 * a shape diagram just clicked) isn't clicked again, and a focused
 * fretboard cell isn't tapped. The key is taken in the capture phase,
 * before the focused element's own handlers see it. Space is left
 * alone in a field, where it types or opens a menu, and in the site's nav
 * and footer, where it presses their buttons as usual. Holding the key
 * down calls `onPress` once.
 *
 * Space also takes focus off the button it overrides: after a key press
 * the browser would otherwise draw its focus ring around that button
 * (say, the shape that just stopped being selected).
 */
export function useSpaceKey(onPress: () => void) {
  useEffect(() => {
    const isOurs = (e: KeyboardEvent) =>
      e.key === ' ' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      && !(e.target as Element | null)?.closest?.('input, select, textarea, nav, footer');
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isOurs(e)) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.repeat) return;
      // A fretboard cell is an SVG element, not an HTML one.
      const focused = document.activeElement;
      if (focused instanceof HTMLElement || focused instanceof SVGElement) focused.blur();
      onPress();
    };
    // Some browsers click a focused button when space comes up, not when it goes down.
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isOurs(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      window.removeEventListener('keyup', onKeyUp, { capture: true });
    };
  }, [onPress]);
}
