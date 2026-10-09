import { useEffect } from 'react';

/**
 * Space anywhere on the page calls `onPress`, in place of what the key
 * would otherwise do: it doesn't scroll the page, and a focused button
 * (say, a shape diagram just clicked) isn't clicked again. Space is left
 * alone in a field, where it types or opens a menu, and in the site's nav
 * and footer, where it presses their buttons as usual. Holding the key
 * down calls `onPress` once.
 */
export function useSpaceKey(onPress: () => void) {
  useEffect(() => {
    const isOurs = (e: KeyboardEvent) =>
      e.key === ' ' && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey
      && !(e.target as Element | null)?.closest?.('input, select, textarea, nav, footer');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !isOurs(e)) return;
      e.preventDefault();
      if (!e.repeat) onPress();
    };
    // Some browsers click a focused button when space comes up, not when it goes down.
    const onKeyUp = (e: KeyboardEvent) => {
      if (isOurs(e)) e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [onPress]);
}
