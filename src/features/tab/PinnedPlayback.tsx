import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Keeps the shown playback controls in sight while the page scrolls (#151): sticky at the window's
 * bottom while the clip's card reaches past it, settling back under the tab at the card's end. The
 * small show/hide toggle is part of them, so it travels with them. Hidden, the toggle stays in its
 * place under the tab.
 */
export function PinnedPlayback({ shown, children }: { shown: boolean; children: ReactNode }) {
  const boxRef = useRef<HTMLDivElement>(null);
  // Stuck at the window's bottom rather than in its place under the tab: then a line runs over it.
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || !shown) return;
    // Sticky at bottom -1px: while stuck, one pixel of it is outside the window.
    const observer = new IntersectionObserver(([entry]) => setStuck(entry.intersectionRatio < 1), { threshold: [1] });
    observer.observe(box);
    return () => observer.disconnect();
  }, [shown]);

  if (!shown) return <div>{children}</div>;
  return <div ref={boxRef} className="tab-pin" data-stuck={stuck || undefined}>{children}</div>;
}
