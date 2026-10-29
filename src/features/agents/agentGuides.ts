/**
 * What the Agents page lists: one entry per page an agent can write
 * for, with its skill (shown on the page) and the guide the skill sends
 * the agent to, both served from `public/`.
 * `public/llms.txt` lists the same files for agents.
 */
export interface AgentGuide {
  /** The Frets page the agent writes for. */
  page: string;
  title: string;
  summary: string;
  /** The plain-text guide, a path under `public/`. */
  guide: string;
  /** The Agent Skill (a SKILL.md), a path under `public/`. */
  skill: string;
}

export const AGENT_GUIDES: readonly AgentGuide[] = [
  {
    page: '/chords',
    title: 'Chords',
    summary: 'Chords and voicings, or a progression as one link per chord, that open on the Chords page.',
    guide: '/chord-links.txt',
    skill: '/skills/frets-chords/SKILL.md',
  },
  {
    page: '/tab',
    title: 'Tab',
    summary: 'Riffs, solos and tab read from a picture, written as alphaTex and opened on the Tab page by a link.',
    guide: '/tab-alphatex.txt',
    skill: '/skills/frets-tab/SKILL.md',
  },
];
