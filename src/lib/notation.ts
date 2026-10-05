/** "F##" → "F𝄪", "Bb" → "B♭": tonal's ASCII spelling with real glyphs. */
export function prettyNote(note: string): string {
  const acc = note.slice(1)
    .replace('##', '𝄪').replace('bb', '𝄫')
    .replace('#', '♯').replace('b', '♭');
  return note[0] + acc;
}
