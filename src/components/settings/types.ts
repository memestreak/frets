import type { ReactNode } from 'react';

/**
 * What a page hands the Settings dialog (`docs/specs/2026-10-29-settings-design.md`): its group, a
 * list of sections, each a list of fields. A section is one saved key (`<app>.<page>.<section>`)
 * holding one object; a field is one of that object's values (`<app>.<page>.<section>.<setting>`).
 */

/** What a field's control is given: the section's staged value, and a way to stage a new one. */
export interface FieldProps<V> {
  value: V;
  set: (next: V) => void;
  /** The id of the row's label, for the control's `aria-labelledby`. */
  labelId: string;
  /** The field needs another one on, and it is off (G1): shown, but not usable. */
  disabled: boolean;
}

export interface SettingsField<V> {
  /** The setting's name in the section's object; its default is the section's `defaults[key]`. */
  key: keyof V & string;
  /** The row's label, a full word or two; double-click (or long-press) it to reset the value. */
  label: string;
  /** Usable only while this holds (Count-in bars needs Count in); always shown, so the pane never moves. */
  enabled?: (value: V) => boolean;
  control: (props: FieldProps<V>) => ReactNode;
}

export interface SettingsSection<V> {
  /** The section's name in its key: `playback` in `frets.tab.playback`. */
  id: string;
  /** As people see it in the tree, matching the group of controls they already know (Playback, Notation…). */
  name: string;
  /** As saved now: the page's own state, which its in-page controls change too. */
  value: V;
  defaults: V;
  /** Saves a staged value: the page's state setter, so the page updates at once and its key is written. */
  save: (value: V) => void;
  fields: SettingsField<V>[];
}

/** Any section, its value type forgotten so a group can list sections of different types. */
export type AnySection = SettingsSection<Record<string, unknown>>;

/** Keeps a section's types checked where it is written, then lets it join a group. */
export const section = <V extends object>(s: SettingsSection<V>): AnySection => s as unknown as AnySection;

export interface SettingsGroup {
  /** The page's name in its keys (`tab`), or `general` for what covers the whole app. */
  id: string;
  name: string;
  /** Most used first; a section with nothing to choose yet isn't listed. */
  sections: AnySection[];
}

/** Where the dialog opens: a group, expanded, at one of its sections. */
export interface SettingsPlace {
  group: string;
  section: string;
}
