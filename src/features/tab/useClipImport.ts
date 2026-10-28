import { useEffect, useEffectEvent, type Dispatch } from 'react';
import type { Clip } from './clip';
import type { ClipAction } from './clipState';
import { loadBuiltins } from './builtins';
import type { Notice } from './notice';
import { isTabFile, readTab } from './readTab';

const HASH = '#tab=';
/** An example's link, /tab#example=bends; it stays in the address while the example is shown. */
const EXAMPLE_HASH = '#example=';
const BAD_ENCODING = 'The link\'s tab is not percent-encoded correctly.';

/**
 * What replaces the clip, and what brings it back: Import, a drop anywhere on the page or a `#tab=`
 * link open as a new arrangement (`openNew`); an example (Arrangements… or an `#example=` link) is shown in its place until
 * `leaveExample`. Each says on the page what it guessed, or why it couldn't.
 */
export function useClipImport({ dispatch, openNew, onNotice, showTab, toStart }: {
  dispatch: Dispatch<ClipAction>;
  /** Opens a clip as a new arrangement. */
  openNew: (clip: Clip) => void;
  onNotice: (notice: Notice | null) => void;
  /** Shows the Notation view, where a clip just brought in is seen. */
  showTab: () => void;
  /** Puts the cursor on the first column, with nothing selected. */
  toStart: () => void;
}) {
  /** Reads `text`; on success opens it as a new arrangement (in place of an example too) and returns null, else the errors. */
  const importText = async (text: string): Promise<string[] | null> => {
    const result = await readTab(text);
    if (!result.ok) return result.errors;
    openNew(result.clip);
    toStart();
    clearHash(EXAMPLE_HASH);
    onNotice(result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null);
    showTab();
    return null;
  };

  /** Shows the example with this id in place of the clip; null when it opened, else why it couldn't. */
  const openExample = async (id: string): Promise<string | null> => {
    // Fetched afresh, so a file dropped into the folder a moment ago opens.
    const chosen = (await loadBuiltins()).find(b => b.id === id);
    if (!chosen) return `There is no example called "${id}".`;
    const result = await readTab(chosen.text);
    if (!result.ok) return result.errors.join(' ');
    dispatch({ type: 'openExample', id, clip: result.clip });
    toStart();
    onNotice(null);
    showTab();
    // The address names the example, so a reload or a copied link shows it again.
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', `${pathname}${search}${EXAMPLE_HASH}${id}`);
    return null;
  };

  const leaveExample = () => {
    dispatch({ type: 'leaveExample' });
    toStart();
    onNotice(null);
    clearHash(EXAMPLE_HASH);
  };

  /** Opens the example in an `#example=` link, or says on the page why it couldn't. */
  const openExampleOrSay = useEffectEvent(async (id: string) => {
    const error = await openExample(id);
    if (error) onNotice({ tone: 'error', lines: [error] });
  });

  /** Imports `text`, or says on the page why it couldn't. */
  const importOrSay = useEffectEvent(async (text: string) => {
    const errors = await importText(text);
    if (errors) onNotice({ tone: 'error', lines: errors });
  });
  const badLink = useEffectEvent(() => onNotice({ tone: 'error', lines: [BAD_ENCODING] }));

  // The tab in a `#tab=` link, on load or when a link is followed while the page is open.
  // The hash is cleared so a reload doesn't import it again.
  useEffect(() => {
    const readLink = () => {
      const { hash } = window.location;
      if (hash.startsWith(EXAMPLE_HASH)) {
        void openExampleOrSay(decodeURIComponent(hash.slice(EXAMPLE_HASH.length)));
        return;
      }
      const text = linkText(hash);
      if (text === null) return;
      const { pathname, search } = window.location;
      window.history.replaceState(null, '', pathname + search);
      if (text instanceof Error) badLink();
      else void importOrSay(text);
    };
    readLink();
    window.addEventListener('hashchange', readLink);
    return () => window.removeEventListener('hashchange', readLink);
  }, []);

  // A file or text dropped anywhere on the page replaces the clip.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(isTabFile);
      const text = file ? await file.text() : e.dataTransfer.getData('text/plain');
      if (text) await importOrSay(text);
    };
    const onDropped = (e: DragEvent) => void onDrop(e);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDropped);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDropped);
    };
  }, []);

  return { importText, openExample, leaveExample };
}

/** Takes an `#example=` link out of the address, once something else is shown in the example's place. */
export const clearExampleHash = () => clearHash(EXAMPLE_HASH);

/** Takes a `#tab=` or `#example=` hash out of the address, so a reload doesn't bring it back. */
function clearHash(prefix: string) {
  const { pathname, search, hash } = window.location;
  if (hash.startsWith(prefix)) window.history.replaceState(null, '', pathname + search);
}

/** The tab in a `#tab=` hash; null when the hash is something else, an Error when it can't be decoded. */
function linkText(hash: string): string | Error | null {
  if (!hash.startsWith(HASH)) return null;
  try {
    return decodeURIComponent(hash.slice(HASH.length));
  } catch (e) {
    return e as Error;
  }
}
