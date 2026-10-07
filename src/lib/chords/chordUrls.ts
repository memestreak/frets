import { CHORD_ROOTS, CHORD_TYPES, type ChordRoot } from './chordTypes';
import { voicingKey, type Voicing } from './voicings';

/*
 * Each chord has its own Chord library URL: /chords/library?chord=am7b5.
 * One page reads the chord from the URL. A slug is the root and the type,
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

/** What /chords/library shows with no chord, or one it doesn't know. */
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

/** The chord's page; with a shape, the page opens on that shape. */
export const chordHref = (choice: ChordChoice, shape?: Voicing): string =>
  `/chords/library?${CHORD_PARAM}=${chordSlug(choice)}`
  + (shape ? `&${SHAPE_PARAM}=${voicingKey(shape)}` : '');

/** Every root and type by slug. Throws at load if two chords share a slug. */
const BY_SLUG = new Map<string, ChordChoice>();
for (const root of CHORD_ROOTS) {
  for (const { id: type } of CHORD_TYPES) {
    const slug = chordSlug({ root, type });
    if (BY_SLUG.has(slug)) throw new Error(`Two chords share the URL slug "${slug}"`);
    BY_SLUG.set(slug, { root, type });
  }
}

/** The chord a slug names; the default for a missing or unknown one. */
export const chordFromSlug = (slug: string | null): ChordChoice =>
  (slug && BY_SLUG.get(slug)) || DEFAULT_CHORD;
