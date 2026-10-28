/** What the line under the clip says: what an import guessed or ignored, why one failed, or that a copy worked. */
export interface Notice {
  tone: 'info' | 'error';
  lines: string[];
}
