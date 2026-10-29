import { PageIcon } from '@/components/PageIcon';
import { AGENT_GUIDES } from './agentGuides';
import { SkillActions } from './SkillActions';

/**
 * The Agents page, linked from the footer (docs/specs/2026-10-29-agent-skills-design.md):
 * per page, its skill to read, copy or download.
 */
export function AgentsPage() {
  return (
    <div className="agents-page grid gap-3">
      <header>
        <h1 className="m-0">Agents</h1>
        <p className="mt-1 mb-0">
          Give an agent one of these skills and it can write chords and tab that open in Frets.
        </p>
      </header>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {AGENT_GUIDES.map(g => (
          <li key={g.page} className="card grid grid-cols-[56px_1fr] gap-x-4 gap-y-3">
            <PageIcon href={g.page} />
            <div className="min-w-0">
              <h2 className="m-0 mb-1.5 text-[17px] leading-6">{g.title}</h2>
              <p className="m-0">{g.summary}</p>
            </div>
            {/* On a phone the buttons take the card's whole width, under the icon too. */}
            <div className="col-span-2 sm:col-span-1 sm:col-start-2">
              <SkillActions skill={g.skill} />
            </div>
          </li>
        ))}
      </ul>
      <p className="m-0 text-(--ink-muted)">
        A skill is a SKILL.md file: save it as <code>frets-chords/SKILL.md</code> or{' '}
        <code>frets-tab/SKILL.md</code> in your agent&apos;s skills folder. Agents that read{' '}
        <a href="/llms.txt" target="_blank" rel="noreferrer">llms.txt</a> find all of this on their own.
      </p>
    </div>
  );
}
