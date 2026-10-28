
/** The colours a clip is drawn in: tokens on the page, concrete colours in an export. */
export interface TabLook {
  ink: string;
  /** The string lines. */
  line: string;
  /** Text on ink, as in a rehearsal mark's box. */
  paper: string;
}

export const PAGE_LOOK: TabLook = {
  ink: 'var(--ink)',
  line: 'var(--line-strong)',
  paper: 'var(--surface-raised)',
};
