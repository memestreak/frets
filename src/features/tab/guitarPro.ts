import type * as AlphaTabModule from '@coderline/alphatab';
import { writeAlphaTex } from './alphatex';
import { loadAlphaTab } from './alphatexRead';
import type { Clip } from './clip';

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
  importer.initFromString(writeAlphaTex(clip), settings);
  const score = importer.readScore();
  return new at.exporter.Gp7Exporter().export(score, settings);
}
