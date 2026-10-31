/** The Metronome page's keys for the `?` overlay; they mirror `useSpaceKey` and `MetronomePage.tsx`. */
import type { ShortcutGroup } from '@/lib/shortcuts';

export const METRONOME_SHORTCUTS: readonly ShortcutGroup[] = [
  {
    title: 'Page',
    shortcuts: [
      { keys: ['Space'], does: 'Start or stop' },
      { keys: ['T'], does: 'Tap the tempo' },
    ],
  },
];
