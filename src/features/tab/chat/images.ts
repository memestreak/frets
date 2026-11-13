/**
 * Images in the Chat panel (`docs/specs/2026-11-13-tab-chat-images-design.md`, issue #465): a picture of
 * a staff, a tab or a chord chart, pasted, dropped or picked, sent with the ask for the model to read.
 * Each is kept as a `data:` URL, the form OpenRouter takes from a browser.
 */

/** The longest side an image is sent at; larger ones are scaled down, keeping their shape. */
export const MAX_IMAGE_EDGE = 2048;

/** An image waiting in the message box, or sent with an ask. */
export interface ChatImage {
  /** A `data:image/…;base64,…` URL. */
  url: string;
  /** The file's name, or '' for a pasted image, for the image's label. */
  name: string;
}

/** The image files among a paste's, a drop's or a file picker's files. */
export function imageFiles(files: Iterable<File> | ArrayLike<File> | null | undefined): File[] {
  return Array.from(files ?? []).filter(file => file.type.startsWith('image/'));
}

/** The size to send an image of `width` by `height` at: as it is, or scaled so its longest side is `MAX_IMAGE_EDGE`. */
export function fittedSize(width: number, height: number, max = MAX_IMAGE_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * An image file as a `data:` URL, scaled down when larger than `MAX_IMAGE_EDGE`, as a PNG so the thin
 * lines of a staff stay sharp. A file the browser can't draw (or one already small enough) is sent as it is.
 */
export async function imageFromFile(file: File): Promise<ChatImage> {
  const name = file.name && !/^image\.\w+$/.test(file.name) ? file.name : '';
  const scaled = await scaledDown(file).catch(() => null);
  return { url: scaled ?? (await dataUrlOf(file)), name };
}

async function scaledDown(file: File): Promise<string | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const bitmap = await createImageBitmap(file);
  try {
    const size = fittedSize(bitmap.width, bitmap.height);
    if (size.width === bitmap.width && size.height === bitmap.height) return null;
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}

function dataUrlOf(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Couldn\'t read the image.'));
    reader.readAsDataURL(file);
  });
}
