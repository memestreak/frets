'use client';

import { useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** The id of the spot in `AppNav`'s bar, before the theme switch, where a page's actions go. */
export const PAGE_ACTIONS_ID = 'page-actions';

const noChange = () => () => {};
const findSlot = () => document.getElementById(PAGE_ACTIONS_ID);
const noSlot = () => null;

/**
 * A page's own buttons (the Tab page's New, Arrangements…, Save…), drawn in the site's top bar beside
 * the theme switch rather than in a row of their own over the page. With no bar (a test rendering the
 * page alone) they are drawn where they stand. The bar is drawn before any page, so its spot is there
 * on the page's first render in the browser; on the server there is none.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const slot = useSyncExternalStore(noChange, findSlot, noSlot);
  return slot ? createPortal(children, slot) : <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>;
}
