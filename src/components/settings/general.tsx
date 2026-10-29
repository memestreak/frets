'use client';

/**
 * Settings' General group: what covers the whole app. For now, Appearance › Theme, the same choice
 * the theme button in the header cycles through.
 */
import { chooseTheme, useTheme } from '@/components/ThemeSwitch';
import type { Appearance, ThemeChoice } from '@/lib/theme';
import { choiceField } from './fields';
import { section, type SettingsGroup } from './types';

const THEMES: readonly (readonly [ThemeChoice, string])[] = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

export function useGeneralGroup(): SettingsGroup {
  const theme = useTheme();
  return {
    id: 'general',
    name: 'General',
    sections: [
      section<Appearance>({
        id: 'appearance', name: 'Appearance',
        value: { theme }, defaults: { theme: 'auto' },
        save: v => chooseTheme(v.theme),
        fields: [choiceField<Appearance, 'theme', ThemeChoice>('theme', 'Theme', THEMES)],
      }),
    ],
  };
}
