
/** The colours a clip is drawn in: tokens on the page, concrete colours in an export. */
export interface TabLook {
  ink: string;
  /** The string lines. */
  line: string;
  /** Text on ink, as in a rehearsal mark's box. */
  paper: string;
}

/** The look a selected or picked thing is drawn in when `lit`: the selection's blue (issues #238, #276). */
export function litLook(look: TabLook, lit: boolean): TabLook {
  return lit ? { ...look, ink: 'var(--select)' } : look;
}

export const PAGE_LOOK: TabLook = {
  ink: 'var(--ink)',
  line: 'var(--line-strong)',
  paper: 'var(--surface-raised)',
};
