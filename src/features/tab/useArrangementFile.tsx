import { useEffect, useEffectEvent, useState } from 'react';
import type { Clip } from './clip';
import { ArrangementChooser } from './ArrangementChooser';
import type { Parts } from './layout';
import type { Notice } from './notice';
import { SaveAsDialog, SaveChangesDialog } from './SaveDialogs';
import type { useArrangements } from './useArrangements';
import { useClipImport } from './useClipImport';

/**
 * The Tab page's file actions (issue #259): New, Arrangements…, Save, Save as…, and asking "Save changes
 * to ‹name›?" before anything replaces unsaved changes; ⌘S, ⇧⌘S and ⌘O; the browser asking before it
 * closes on unsaved changes; and what opens from outside My arrangements (`useClipImport`). `dialogs`
 * draws Arrangements…, Save as… and "Save changes?".
 */
export function useArrangementFile(arrangements: ReturnType<typeof useArrangements>, { parts, onNotice, onShown, showTab, toStart, onInsert }: {
  /** What the chooser's previews draw: the staff, the tab or both. */
  parts: Parts;
  onNotice: (notice: Notice | null) => void;
  /** Another arrangement (or a new one) is shown in place of the open one: the cursor, selection, notice and view start over. */
  onShown: () => void;
  /** Back to the Notation view, and the cursor to the start: a clip from outside opened. */
  showTab: () => void;
  toStart: () => void;
  /** Arrangements…'s Insert: the clip goes in before the cursor. */
  onInsert: (clip: Clip) => void;
}) {
  const { state } = arrangements;
  const [choosing, setChoosing] = useState(false);
  // "Save changes to ‹name›?", and what runs once they are saved or let go.
  const [leaving, setLeaving] = useState<{ then: () => void; onCancel?: () => void } | null>(null);
  // Save As…, and what runs once it has saved (after "Save changes?").
  const [savingAs, setSavingAs] = useState<{ then?: () => void } | null>(null);

  /** Opens Arrangements…, without the Undo of a delete made the time before. */
  const openChooser = () => {
    arrangements.forgetDeleted();
    setChoosing(true);
  };
  /** Runs `then` once unsaved changes are saved or let go, asking first when there are some; `onCancel` when they're kept. */
  const confirmLeave = (then: () => void, onCancel?: () => void) => {
    if (arrangements.unsaved) setLeaving({ then, onCancel });
    else then();
  };
  /** Saves the open arrangement, then runs `then`; one never saved asks for a name and a folder first. */
  const save = (then?: () => void) => {
    if (arrangements.kept && !arrangements.unsaved) then?.();
    else if (arrangements.save()) then?.();
    else setSavingAs({ then });
  };
  /** What is shown in place of the open arrangement: from the Arrangements dialog, or New. */
  const replaceShown = (open: () => void) => {
    open();
    onShown();
    setChoosing(false);
  };
  /** Deletes from the Arrangements dialog, which stays open; when `ids` hold the open one, another is shown. */
  const removing = (ids: string[], remove: () => void) => {
    if (!ids.includes(state.id)) {
      remove();
      return;
    }
    replaceShown(remove);
    setChoosing(true);
  };

  const { importText, openBuiltin } = useClipImport({
    openNew: arrangements.openNew, confirmLeave, open: { id: state.id, unsaved: arrangements.unsaved, kept: arrangements.kept },
    onNotice, showTab, toStart,
  });

  // ⌘S (Ctrl+S) saves, ⇧⌘S is Save As…, ⌘O opens Arrangements…, anywhere on the page, in place of the browser's own.
  const onFileKey = useEffectEvent((e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key !== 's' && key !== 'o') return;
    e.preventDefault();
    // Not over another dialog.
    if (document.querySelector('dialog[open]')) return;
    if (key === 'o') openChooser();
    else if (e.shiftKey) setSavingAs({});
    else save();
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => onFileKey(e);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Closing or reloading the browser tab with unsaved changes asks first; the draft brings them back either way.
  useEffect(() => {
    if (!arrangements.unsaved) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [arrangements.unsaved]);

  const whole = state.clip;
  const dialogs = (
    <>
      <ArrangementChooser
        open={choosing} library={arrangements.library} openId={state.id}
        deleted={arrangements.deleted} parts={parts} onClose={() => setChoosing(false)}
        onOpen={id => {
          setChoosing(false);
          confirmLeave(() => replaceShown(() => {
            if (!arrangements.open(id)) onNotice({ tone: 'error', lines: ['That arrangement could not be read.'] });
          }));
        }}
        onOpenBuiltin={builtin => {
          setChoosing(false);
          confirmLeave(() => void openBuiltin(builtin).then(error => { if (error) onNotice({ tone: 'error', lines: [error] }); }));
        }}
        onInsert={inserted => { setChoosing(false); onInsert(inserted); }}
        onRename={arrangements.rename}
        onMove={arrangements.move}
        // Deleting the open arrangement opens another, or a new clip.
        onDelete={ids => removing(ids, () => arrangements.remove(ids))}
        onCreateFolder={arrangements.createFolder}
        onRenameFolder={arrangements.renameFolder}
        onDeleteFolder={id => removing(
          arrangements.library.items.filter(i => i.folder === id).map(i => i.id), () => arrangements.removeFolder(id),
        )}
        onUndoDelete={arrangements.undoDelete}
      />
      <SaveAsDialog
        open={savingAs !== null} name={whole.name} folders={arrangements.library.folders}
        onClose={() => setSavingAs(null)} onCreateFolder={arrangements.createFolder}
        onSave={(name, into) => {
          const then = savingAs?.then;
          setSavingAs(null);
          arrangements.saveAs(name, typeof into === 'object' ? arrangements.createFolder(into.newFolder) : into);
          then?.();
        }}
      />
      <SaveChangesDialog
        open={leaving !== null} name={whole.name}
        onSave={() => { const then = leaving?.then; setLeaving(null); save(then); }}
        onDiscard={() => { const then = leaving?.then; setLeaving(null); then?.(); }}
        onCancel={() => { const cancel = leaving?.onCancel; setLeaving(null); cancel?.(); }}
      />
    </>
  );

  return {
    openChooser, confirmLeave, importText, dialogs,
    /** Save; ⌘S. */
    save: () => save(),
    /** Save as…; ⇧⌘S. */
    saveAs: () => setSavingAs({}),
    /** New: an empty arrangement, after asking about unsaved changes. */
    openNew: () => confirmLeave(() => replaceShown(() => arrangements.openNew())),
  };
}
