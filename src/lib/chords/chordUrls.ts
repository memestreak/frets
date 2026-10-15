import { CHORD_ROOTS, CHORD_TYPES, type ChordRoot } from './chordTypes';
import { voicingKey, type Voicing } from './voicings';

/*
 * The Chords page's URL names the chord and the shape on the neck:
 * /chords?chord=am7b5&shape=x-0-1-0-1-x. One page reads them from the URL. A slug is the root and the type,
 * lower case, so the URL is easy to type. Four
 * types differ from another only by a capital M (M7b5 and m7b5), so a
 * capital M is written "maj"; a # can't go in a URL path, so it is written
 * "sharp". Every slug is built once, below, and looked up by string.
 */

export interface ChordChoice {
  root: ChordRoot;
  /** A `ChordTypeDef` id: tonal's first alias, e.g. "m7". */
  type: string;
}

/** What /chords shows with no chord or shape, or a chord it doesn't know. */
export const DEFAULT_CHORD: ChordChoice = { root: 'A', type: 'm7' };

/** Types the rule below would spell badly. */
const TYPE_SLUG_OVERRIDES: Record<string, string> = {
  M: '', 'm/ma7': 'mmaj7', '+add#9': 'augaddsharp9',
};

const rootSlug = (root: ChordRoot) => root.replace('#', 'sharp').toLowerCase();

const typeSlug = (type: string) =>
  TYPE_SLUG_OVERRIDES[type] ??
  type.replace(/^M/, 'maj').replace(/#/g, 'sharp').toLowerCase();

/** "am7b5", "fsharpm7", "c7sharp9", "c" for C major. */
export const chordSlug = ({ root, type }: ChordChoice): string => rootSlug(root) + typeSlug(type);

/** The query parameter that names the chord. */
export const CHORD_PARAM = 'chord';

/** The query parameter that names a shape to open on: its `voicingKey`, "x-0-2-0-1-0". */
export const SHAPE_PARAM = 'shape';

/**
 * The Chords page on a chord, a shape or both: a shape alone (notes with
 * no name) is named afresh, a chord alone opens on its first shape.
 */
export function chordHref(choice: ChordChoice | null, shape?: Voicing): string {
  const params = [
    ...(choice ? [`${CHORD_PARAM}=${chordSlug(choice)}`] : []),
    ...(shape ? [`${SHAPE_PARAM}=${voicingKey(shape)}`] : []),
  ];
  return params.length ? `/chords?${params.join('&')}` : '/chords';
}

/** The frets a `shape` value names, "x-0-2-0-1-0"; null unless six frets from 0 to `maxFret`. */
export function shapeFromKey(key: string | null, maxFret: number): Voicing | null {
  const parts = key?.split('-') ?? [];
  if (parts.length !== 6) return null;
  const frets = parts.map(p => (p === 'x' ? null : /^\d+$/.test(p) ? Number(p) : NaN));
  return frets.every(f => f === null || f <= maxFret) ? frets : null;
}

/** Every root and type by slug. Throws at load if two chords share a slug. */
const BY_SLUG = new Map<string, ChordChoice>();
for (const root of CHORD_ROOTS) {
  for (const { id: type } of CHORD_TYPES) {
    const slug = chordSlug({ root, type });
    if (BY_SLUG.has(slug)) throw new Error(`Two chords share the URL slug "${slug}"`);
    BY_SLUG.set(slug, { root, type });
  }
}

/** The chord a slug names; null for a missing or unknown one. */
export const chordFromSlug = (slug: string | null): ChordChoice | null =>
  (slug && BY_SLUG.get(slug)) || null;
