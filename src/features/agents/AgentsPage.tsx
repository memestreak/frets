import type { ReactNode } from 'react';
import { PageIcon } from '@/components/PageIcon';
import { AGENT_CONNECTORS, AGENT_GUIDES } from './agentGuides';
import { ConnectorActions } from './ConnectorActions';
import { SkillActions } from './SkillActions';

/**
 * The Agents page, linked from the footer (docs/specs/2026-10-29-agent-skills-design.md):
 * per page, its skill to read, copy or download; then the connectors to add to a chat app.
 */
export function AgentsPage() {
  return (
    <div className="agents-page grid gap-3">
      <header>
        <h1 className="m-0">Agents</h1>
        <p className="mt-1 mb-0">
          Give an agent one of these skills and it can write chords and tab that open in Frets.
          Add the connector to your chat app and the metronome plays right in the chat.
        </p>
      </header>
      <h2 className="m-0 mt-3">Skills</h2>
      <Cards>
        {AGENT_GUIDES.map(g => (
          <Card key={g.page} page={g.page} title={g.title} summary={g.summary}>
            <SkillActions skill={g.skill} />
          </Card>
        ))}
      </Cards>
      <p className="m-0 text-(--ink-muted)">
        A skill is a SKILL.md file: save it as <code>frets-chords/SKILL.md</code> or{' '}
        <code>frets-tab/SKILL.md</code> in your agent&apos;s skills folder.
      </p>
      <h2 className="m-0 mt-3">Connectors</h2>
      <Cards>
        {AGENT_CONNECTORS.map(c => (
          <Card key={c.page} page={c.page} title={c.title} summary={c.summary}>
            <ConnectorActions url={c.url} />
          </Card>
        ))}
      </Cards>
      <p className="m-0 text-(--ink-muted)">
        A connector is an MCP server: in Claude, add it under Settings › Connectors › Add custom
        connector. Chat apps that show MCP Apps draw the metronome; others get a line of text.
      </p>
      <p className="m-0 mt-3 text-(--ink-muted)">
        Agents that read <a href="/llms.txt" target="_blank" rel="noreferrer">llms.txt</a> find all
        of this on their own.
      </p>
    </div>
  );
}

function Cards({ children }: { children: ReactNode }) {
  return <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">{children}</ul>;
}

/** A page's card: its icon, title and what an agent can do with it, then its actions. */
function Card({ page, title, summary, children }: { page: string; title: string; summary: string; children: ReactNode }) {
  return (
    <li className="card grid grid-cols-[56px_1fr] gap-x-4 gap-y-3">
      <PageIcon href={page} />
      <div className="min-w-0">
        <h3 className="m-0 mb-1.5 text-[17px] leading-6">{title}</h3>
        <p className="m-0">{summary}</p>
      </div>
      {/* On a phone the actions take the card's whole width, under the icon too. */}
      <div className="col-span-2 sm:col-span-1 sm:col-start-2">{children}</div>
    </li>
  );
}
