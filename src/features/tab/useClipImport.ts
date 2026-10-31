import { useEffect, useEffectEvent, useRef } from 'react';
import type { Clip } from './clip';
import { loadBuiltins, type Builtin } from './builtins';
import type { Notice } from './notice';
import { isTabFile, readTab } from './readTab';
import { isTabLink, readLink } from './shareLink';

/** A built-in arrangement's link, /tab#example=bends. */
const EXAMPLE_HASH = '#example=';

/** Whether the address holds a link that opens a clip: `#tab=`, `#tabz=` or `#example=`. */
const isOpeningLink = (hash: string) => isTabLink(hash) || hash.startsWith(EXAMPLE_HASH);

/**
 * What opens a clip from outside My arrangements (issue #259): Import, a drop anywhere on the page, a
 * `#tab=` / `#tabz=` link, and a built-in arrangement (Arrangements… or an `#example=` link). Each
 * opens as a new arrangement, not saved until Save; each but Import asks first about unsaved changes
 * (`confirmLeave`; Import asks when its dialog opens). A link's hash stays in the address until the
 * clip is edited, saved or replaced, so a reload before then opens the link again. Each says on the
 * page what it guessed, or why it couldn't.
 */
export function useClipImport({ openNew, confirmLeave, open, onNotice, showTab, toStart }: {
  /** Opens a clip as a new arrangement, not saved yet; its id. */
  openNew: (clip: Clip) => string;
  /** Runs `then` once unsaved changes are saved or let go; `onCancel` when the person keeps them. */
  confirmLeave: (then: () => void, onCancel?: () => void) => void;
  /** The open arrangement: its id, and whether it has unsaved changes or is saved. */
  open: { id: string; unsaved: boolean; kept: boolean };
  onNotice: (notice: Notice | null) => void;
  /** Shows the Notation view, where a clip just brought in is seen. */
  showTab: () => void;
  /** Puts the cursor on the first column, with nothing selected. */
  toStart: () => void;
}) {
  // The arrangement a link opened, while its hash is in the address.
  const linked = useRef<string | null>(null);
  // The link last followed, so React's second run of an effect in development doesn't open it twice.
  const followed = useRef('');

  /** Reads `text`; on success opens it as a new arrangement and returns null, else the errors. `hash` is the link it came from. */
  const importText = async (text: string, hash = ''): Promise<string[] | null> => {
    const result = await readTab(text);
    if (!result.ok) return result.errors;
    const id = openNew(result.clip);
    toStart();
    onNotice(result.warnings.length > 0 ? { tone: 'info', lines: result.warnings } : null);
    showTab();
    // The address names the link it came from until the clip changes; anything else takes a link out.
    const { pathname, search } = window.location;
    window.history.replaceState(null, '', pathname + search + hash);
    followed.current = hash;
    linked.current = hash ? id : null;
    return null;
  };

  /** Opens a built-in arrangement as a new one, its link in the address; null when it opened, else why it couldn't. */
  const openBuiltin = async ({ id, text }: Builtin): Promise<string | null> => {
    const errors = await importText(text, `${EXAMPLE_HASH}${encodeURIComponent(id)}`);
    return errors && errors.join(' ');
  };

  /** Opens the built-in arrangement an `#example=` link names; null when it opened, else why it couldn't. */
  const openExample = async (id: string): Promise<string | null> => {
    // Fetched afresh, so a file dropped into the folder a moment ago opens.
    const chosen = (await loadBuiltins()).find(b => b.id === id);
    if (!chosen) return `There is no example called "${id}".`;
    return openBuiltin(chosen);
  };

  /** Imports `text`, or says on the page why it couldn't (and takes a link that failed out of the address). */
  const importOrSay = async (text: string, hash = '') => {
    const errors = await importText(text, hash);
    if (errors) failed(errors, hash);
  };

  /** Says why a link (`hash`) or a drop couldn't open; a link that failed leaves the address. */
  const failed = (lines: string[], hash = '') => {
    onNotice({ tone: 'error', lines });
    if (!hash) return;
    clearLinkHash();
    followed.current = '';
    linked.current = null;
  };

  /** Opens the link in the address, once any unsaved changes are saved or let go; keeping them takes the link out. */
  const followLink = useEffectEvent(() => {
    const { hash } = window.location;
    if (!isOpeningLink(hash) || hash === followed.current) return;
    followed.current = hash;
    confirmLeave(() => {
      void (async () => {
        if (hash.startsWith(EXAMPLE_HASH)) {
          const error = await openExample(decodeURIComponent(hash.slice(EXAMPLE_HASH.length)));
          if (error) failed([error], hash);
          return;
        }
        const link = await readLink(hash);
        if (link instanceof Error) failed([link.message], hash);
        else if (link !== null) await importOrSay(link, hash);
      })();
    }, () => {
      clearLinkHash();
      followed.current = '';
    });
  });

  // A link, on load or when one is followed while the page is open.
  useEffect(() => {
    const onHashChange = () => followLink();
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // The link leaves the address once the clip it opened is edited, saved or replaced.
  useEffect(() => {
    if (linked.current === null) return;
    if (open.id === linked.current && !open.unsaved && !open.kept) return;
    linked.current = null;
    followed.current = '';
    clearLinkHash();
  }, [open.id, open.unsaved, open.kept]);

  /** A file or text dropped on the page opens, once unsaved changes are saved or let go. */
  const onDrop = useEffectEvent((text: string) => confirmLeave(() => void importOrSay(text)));

  // A file or text dropped anywhere on the page replaces the clip.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDropped = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      const file = [...e.dataTransfer.files].find(isTabFile);
      const text = file ? await file.text() : e.dataTransfer.getData('text/plain');
      if (text) onDrop(text);
    };
    const onDropEvent = (e: DragEvent) => void onDropped(e);
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('drop', onDropEvent);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('drop', onDropEvent);
    };
  }, []);

  return { importText, openBuiltin };
}

/** Takes a link that opens a clip out of the address, so a reload doesn't bring it back. */
export function clearLinkHash() {
  const { pathname, search, hash } = window.location;
  if (isOpeningLink(hash)) window.history.replaceState(null, '', pathname + search);
}
