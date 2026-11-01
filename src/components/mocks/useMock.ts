'use client';

/**
 * Mocks a page offers while Jeremy picks between looks (`docs/specs/2026-11-01-mock-switcher-design.md`).
 * A page declares each mock with `useMock`, which reads its choice from the link (`?mock=b`); the
 * `MockSwitcher` that `AppShell` mounts lists the page's mocks and switches them in place.
 */
import { useEffect, useSyncExternalStore } from 'react';

export type MockOption = { value: string; label: string };

/** One mock: its link parameter, its name in the switcher, and its options, the first the default. */
export type Mock = { param: string; label: string; options: readonly MockOption[] };

const NONE: readonly Mock[] = [];

/** The mocks of the page shown, in the order they were declared. */
let mocks: readonly Mock[] = NONE;
const listeners = new Set<() => void>();

function changed() {
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Back and Forward change the link without a word to us.
  if (listeners.size === 1) window.addEventListener('popstate', changed);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('popstate', changed);
  };
}

/** The link's query, e.g. `?mock=b&blue=2`; the server has none. */
function useSearch(): string {
  return useSyncExternalStore(subscribe, () => window.location.search, () => '');
}

/** The option `search` picks for `mock`: the one named in the link, else the first. */
export function chosen(mock: Mock, search: string): string {
  const value = new URLSearchParams(search).get(mock.param);
  return mock.options.some(option => option.value === value) ? value! : mock.options[0].value;
}

/**
 * Declares a mock while the page is shown and returns its option. Pass a module constant: a new
 * object each render re-declares it.
 */
export function useMock(mock: Mock): string {
  useEffect(() => {
    mocks = [...mocks, mock];
    changed();
    return () => {
      mocks = mocks.filter(m => m !== mock);
      changed();
    };
  }, [mock]);
  return chosen(mock, useSearch());
}

/** Switches a mock to `value` in the link, in place: no reload, no new history entry. */
export function setMock(mock: Mock, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(mock.param, value);
  window.history.replaceState(window.history.state, '', url);
  changed();
}

/** For the switcher: the page's mocks once the link names any of them, else none (it hides). */
export function useShownMocks(): { mocks: readonly Mock[]; search: string } {
  const search = useSearch();
  const declared = useSyncExternalStore(subscribe, () => mocks, () => NONE);
  const params = new URLSearchParams(search);
  return { mocks: declared.some(m => params.has(m.param)) ? declared : NONE, search };
}
