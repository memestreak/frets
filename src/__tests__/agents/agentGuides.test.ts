import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Interval, Note } from 'tonal';
import { describe, expect, it } from 'vitest';
import { CHORD_TYPES } from '@/lib/theory/chords';
import { chordFromSlug, chordSlug, shapeFromKey } from '@/lib/chords/chordUrls';
import { AGENT_GUIDES, MCP_SERVER } from '@/features/agents/agentGuides';

/*
 * The agents' guides and skills in public/ against the code they describe
 * (docs/specs/2026-10-29-agent-skills-design.md). The chord list in
 * chord-links.txt is generated: run `UPDATE_GUIDES=1 npm test` to rewrite it.
 */

const PUBLIC = join(__dirname, '../../../public');
const read = (path: string) => readFileSync(join(PUBLIC, path), 'utf8');

const START = '--- generated from the code: do not edit by hand ---';
const END = '--- end of generated list ---';

/** "3m" → "b3", "5A" → "#5", "7d" → "bb7": as guitarists write a degree. */
function degree(name: string): string {
  const { num, q } = Interval.get(name);
  if (q === 'm') return `b${num}`;
  if (q === 'A') return `#${num}`;
  if (q === 'd') return `${num === 7 ? 'bb' : 'b'}${num}`;
  return String(num);
}

/** One line per chord type: its slug after the root, how Frets prints it, its degrees. */
function chordTypeList(): string {
  const rows = CHORD_TYPES.map(t => [
    chordSlug({ root: 'C', type: t.id }).slice(1) || '(none)',
    `C${t.symbol}`,
    t.intervals.map(degree).join(' '),
  ]);
  const widths = [0, 1].map(i => Math.max(...rows.map(r => r[i].length)) + 2);
  return rows.map(([slug, symbol, degrees]) =>
    `    ${slug.padEnd(widths[0])}${symbol.padEnd(widths[1])}${degrees}`.trimEnd()).join('\n');
}

describe('chord-links.txt', () => {
  const doc = read('chord-links.txt');

  it('lists every chord type the Chords page opens', () => {
    const start = doc.indexOf(START) + START.length;
    const end = doc.indexOf(END);
    const want = `\n${chordTypeList()}\n`;
    if (process.env.UPDATE_GUIDES && doc.slice(start, end) !== want) {
      writeFileSync(join(PUBLIC, 'chord-links.txt'), doc.slice(0, start) + want + doc.slice(end));
      return;
    }
    expect(doc.slice(start, end), 'run UPDATE_GUIDES=1 npm test').toBe(want);
  });
});

/** Every chords link written in the guides and skills. */
const chordLinks = (text: string) =>
  [...text.matchAll(/\/chords\?(\S+)/g)].map(m => new URLSearchParams(m[1]));

describe('the chord links in chord-links.txt', () => {
  const text = read('chord-links.txt');

  it.each(chordLinks(text).filter(p => !p.toString().includes('%3C')).map(p => [p.toString(), p]))(
    '%s opens what it names',
    (_, params) => {
      const chord = params.get('chord');
      const shape = params.get('shape');
      const choice = chord === null ? null : chordFromSlug(chord);
      if (chord !== null) expect(choice, `chord=${chord}`).not.toBeNull();
      if (shape === null) return;
      const frets = shapeFromKey(shape, 15);
      expect(frets, `shape=${shape}`).not.toBeNull();
      if (!choice) return;
      // The shape plays only the chord's notes.
      const open = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'];
      const played = frets!.flatMap((f, i) => (f === null ? [] : [(Note.chroma(open[i])! + f) % 12]));
      const def = CHORD_TYPES.find(t => t.id === choice.type)!;
      const tones = def.semis.map(s => (Note.chroma(choice.root)! + s) % 12);
      for (const pc of played) expect(tones, `${shape} under ${chord}`).toContain(pc);
    },
  );
});

describe('the shapes in the shape table of chord-links.txt', () => {
  const rows = [...read('chord-links.txt').matchAll(/^ {4}([x\d]+(?:-[x\d]+){5}) /gm)].map(m => m[1]);

  it.each(rows)('%s is a shape the page reads', shape => {
    expect(shapeFromKey(shape, 15)).not.toBeNull();
  });
});

describe('the files the agents page and llms.txt point to', () => {
  const llms = read('llms.txt');

  it.each(AGENT_GUIDES.flatMap(g => [g.guide, g.skill]))('%s exists and is in llms.txt', path => {
    expect(existsSync(join(PUBLIC, path))).toBe(true);
    expect(llms).toContain(`https://frets.eminor.net${path}`);
  });

  it.each(AGENT_GUIDES.map(g => g.skill))('%s is an Agent Skill named after its folder', path => {
    const text = read(path);
    // The description is folded (">-") so the front matter stays within 80 columns.
    const front = /^---\nname: ([a-z0-9-]+)\ndescription: >-\n((?: {2}\S.*\n)+)---\n/.exec(text);
    expect(front).not.toBeNull();
    expect(path).toBe(`/skills/${front![1]}/SKILL.md`);
    for (const line of front![0].split('\n')) expect(line.length).toBeLessThanOrEqual(80);
    const description = front![2].trim().split(/\n {2}/).join(' ');
    expect(description.length).toBeLessThanOrEqual(1024);
    // The skill sends the agent to its guide, which carries the details.
    expect(text).toContain(`https://frets.eminor.net${AGENT_GUIDES.find(g => g.skill === path)!.guide}`);
  });
});

// That the server serves these tools is checked in src/__tests__/mcp/server.test.ts.
describe('the MCP server the agents page and llms.txt list', () => {
  const llms = read('llms.txt');

  it('is in llms.txt with every tool', () => {
    expect(llms).toContain(`](${MCP_SERVER.url})`);
    for (const t of MCP_SERVER.tools) expect(llms).toContain(`\`${t.name}\``);
  });
});
