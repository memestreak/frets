import { useLayoutEffect, useMemo, useRef } from 'react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any handler, whatever it takes
type Handler = (...args: any[]) => unknown;

/**
 * The same handlers on every render, each calling the latest one given: so a `memo` component handed
 * them (`TabClip`) draws again only when what it shows changes, not each time the page draws (a
 * playback step). A handler left out (undefined) stays out, and one put back is new.
 *
 * The latest handlers take over once the page has committed, before any press can reach them.
 */
export function useStableHandlers<T extends Record<string, Handler | undefined>>(handlers: T): T {
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const given = Object.keys(handlers).filter(name => handlers[name] !== undefined).join(' ');
  return useMemo(() => Object.fromEntries(given.split(' ').filter(Boolean).map(name => [
    name, (...args: unknown[]) => latest.current[name]!(...args),
  ])) as T, [given]);
}
