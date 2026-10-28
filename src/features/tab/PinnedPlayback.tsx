import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Where the shown playback controls stay while the page scrolls (#151):
 * - 'card': at the window's bottom while the clip's card reaches past it, settling back under the tab
 *   at the card's end (sticky);
 * - 'window': always at the window's bottom, a bar the window's width (fixed), with room kept under
 *   the page so it never covers the end of the tab.
 * Hidden, the small toggle stays where it is, under the tab.
 */
export type PlaybackPin = 'card' | 'window';

/** Wraps the playback footer, a child of the clip's card. */
export function PinnedPlayback({ pin, shown, children }: { pin: PlaybackPin; shown: boolean; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Stuck at the window's bottom rather than in its place under the tab: then it draws a top line.
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !shown || pin !== 'card' || typeof IntersectionObserver === 'undefined') return;
    // Sticky at bottom -1px: while stuck, one pixel of it is outside the window.
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), { threshold: [1] });
    observer.observe(box);
    return () => observer.disconnect();
  }, [pin, shown]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !shown || pin !== 'window' || typeof ResizeObserver === 'undefined') return;
    // Room kept under the page, so it scrolls far enough to show the tab's end and the footer above the bar.
    const observer = new ResizeObserver(() => { document.body.style.paddingBottom = `${box.offsetHeight}px`; });
    observer.observe(box);
    return () => {
      observer.disconnect();
      document.body.style.paddingBottom = '';
    };
  }, [pin, shown]);

  if (!shown) return <div ref={boxRef}>{children}</div>;
  if (pin === 'card') {
    return <div ref={boxRef} className="tab-pin-card" data-stuck={stuck || undefined}>{children}</div>;
  }
  return (
    <div ref={boxRef} className="tab-pin-window">
      <div className="tab-pin-window-inner">{children}</div>
    </div>
  );
}
