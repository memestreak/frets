import { PageIcon } from '@/components/PageIcon';
import { SaveIcon } from '@/components/icons';
import { AGENT_GUIDES, SITE } from './agentGuides';
import { CopyUrl } from './CopyUrl';

/**
 * The AI agents page, linked from the footer (docs/specs/2026-10-29-agent-skills-design.md):
 * per page, the guide to give an agent and the skill to install.
 */
export function AgentsPage() {
  return (
    <div className="agents-page grid gap-3">
      <header>
        <h1 className="m-0">AI agents</h1>
        <p className="mt-1 mb-0">
          Give an AI agent one of these guides and it can write chords and tab that open in Frets.
          Paste the guide&apos;s link into the chat, or install the skill once.
        </p>
      </header>
      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
        {AGENT_GUIDES.map(g => (
          <li key={g.page} className="card flex-row items-start gap-4">
            <PageIcon href={g.page} />
            <div className="grid min-w-0 flex-1 gap-3">
              <div>
                <h2 className="m-0 mb-1.5 text-[17px] leading-6">{g.title}</h2>
                <p className="m-0">{g.summary}</p>
              </div>
              <div className="grid gap-1">
                <span className="card-kicker">Guide</span>
                <CopyUrl url={SITE + g.guide} />
              </div>
              <a
                href={g.skill} download="SKILL.md"
                className="btn btn-secondary justify-self-start text-inherit no-underline"
              >
                <SaveIcon /> Download skill
              </a>
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
