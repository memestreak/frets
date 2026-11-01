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

/**
 * MCP servers an agent's chat app can add as a connector, each showing a
 * Frets page in the chat. `public/llms.txt` lists them too.
 */
export interface AgentConnector {
  /** The Frets page the connector shows in the chat. */
  page: string;
  title: string;
  summary: string;
  /** The server's URL, to paste into the chat app. */
  url: string;
  /** The tool the model calls. */
  tool: string;
}

export const AGENT_CONNECTORS: readonly AgentConnector[] = [
  {
    page: '/metronome',
    title: 'Metronome',
    summary: 'Ask for a click in any tempo and meter, and a metronome you can play appears in the chat.',
    url: 'https://frets.eminor.net/mcp',
    tool: 'show_metronome',
  },
];
