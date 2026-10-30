/**
 * Saves a file the Tab page made: through the browser's Save As dialog where
 * it has one (Chrome and Edge: `showSaveFilePicker`), so the name and folder
 * can be chosen, else as a download.
 */

interface SavePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ name: string; createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
}

export interface SaveKind {
  /** What the Save As dialog calls the file type. */
  description: string;
  mime: string;
  /** The file name's ending, with its dot: ".png", ".alphatex.txt". */
  extension: string;
}

export const SAVE_KINDS = {
  png: { description: 'PNG image', mime: 'image/png', extension: '.png' },
  svg: { description: 'SVG image', mime: 'image/svg+xml', extension: '.svg' },
  ascii: { description: 'ASCII tab', mime: 'text/plain', extension: '.txt' },
  alphatex: { description: 'alphaTex', mime: 'text/plain', extension: '.alphatex.txt' },
  musicxml: { description: 'MusicXML', mime: 'application/vnd.recordare.musicxml+xml', extension: '.musicxml' },
  guitarPro: { description: 'Guitar Pro file', mime: 'application/octet-stream', extension: '.gp' },
} satisfies Record<string, SaveKind>;

/**
 * Asks where to save, then writes what `make` makes. The picker opens first, while the press
 * that asked still counts as the person's own act (a browser rule), and `make` runs after.
 * Resolves to the line the page shows, or null when the dialog was cancelled.
 */
export async function saveFile(baseName: string, kind: SaveKind, make: () => Blob | Promise<Blob>): Promise<string | null> {
  const fileName = `${baseName}${kind.extension}`;
  const win = window as unknown as SavePickerWindow;
  if (win.showSaveFilePicker) {
    let handle;
    try {
      // The picker wants a plain ending, so ".alphatex.txt" is offered as ".txt".
      const ending = kind.extension.slice(kind.extension.lastIndexOf('.'));
      handle = await win.showSaveFilePicker({ suggestedName: fileName, types: [{ description: kind.description, accept: { [kind.mime]: [ending] } }] });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return null;
      throw e;
    }
    const out = await handle.createWritable();
    await out.write(await make());
    await out.close();
    return `Saved ${handle.name}.`;
  }
  const url = URL.createObjectURL(await make());
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Downloaded ${fileName}.`;
}
