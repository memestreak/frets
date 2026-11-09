import type * as AlphaTabModule from '@coderline/alphatab';
import { writeAlphaTex } from './alphatex';
import { loadAlphaTab } from './alphatexRead';
import type { Clip } from './clip';
import { drawnText } from './textMarks';

type AlphaTab = typeof AlphaTabModule;

/**
 * The clip as a Guitar Pro file (`.gp`, Guitar Pro 7 and later), every track: its alphaTex read by
 * alphaTab's own reader, then written by alphaTab's `Gp7Exporter`. Guitar Pro, MuseScore and
 * TuxGuitar open it. What alphaTab doesn't read (Frets' FX line, kept alphaTex it ignores) is left
 * out. See `docs/specs/2026-10-30-tab-guitar-pro-export-design.md`.
 */
export async function writeGuitarPro(clip: Clip): Promise<Uint8Array> {
  return writeGuitarProWith(await loadAlphaTab(), clip);
}

/** `writeGuitarPro` with alphaTab already loaded: what tests call. */
export function writeGuitarProWith(at: AlphaTab, clip: Clip): Uint8Array {
  const settings = new at.Settings();
  const importer = new at.importer.AlphaTexImporter();
  importer.logErrors = false;
  importer.initFromString(writeAlphaTex(withPlainTexts(clip)), settings);
  const score = importer.readScore();
  return new at.exporter.Gp7Exporter().export(score, settings);
}

/**
 * The clip with each Text as Guitar Pro can show it: its Markdown marks left out, as a Guitar Pro text
 * has no bold, so "**Esc**" goes as "Esc" (issue #446); and its new lines as spaces, as a Guitar Pro
 * text is one line (issue #445).
 */
export function withPlainTexts(clip: Clip): Clip {
  return {
    ...clip,
    tracks: clip.tracks.map(track => ({
      ...track,
      bars: track.bars.map(bar => ({
        ...bar,
        voices: bar.voices.map(columns => columns.map(column => (column.text ? { ...column, text: drawnText(column.text).replace(/\n/g, ' ') } : column))),
      })),
    })),
  };
}
