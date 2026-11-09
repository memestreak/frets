import { render } from '@testing-library/react';
import { parseInlines, parseMarkdown, safeHref } from '@/features/tab/chat/markdown';
import { ReplyMarkdown } from '@/features/tab/chat/ReplyMarkdown';

// Issue #427: a Chat reply's markdown, read safely and drawn without HTML.
const html = (text: string) => render(<ReplyMarkdown text={text} />).container.firstElementChild!.innerHTML;

describe('parseMarkdown blocks', () => {
  it('splits paragraphs at blank lines and keeps single newlines as breaks', () => {
    expect(parseMarkdown('One\ntwo\n\nThree')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'One' }, { kind: 'break' }, { kind: 'text', text: 'two' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Three' }] },
    ]);
  });

  it('reads headings, but not #hashtags', () => {
    expect(parseMarkdown('## Bar 3')[0]).toEqual({ kind: 'heading', level: 2, inlines: [{ kind: 'text', text: 'Bar 3' }] });
    expect(parseMarkdown('### In C# minor ##')[0]).toMatchObject({ level: 3, inlines: [{ text: 'In C# minor' }] });
    expect(parseMarkdown('#hashtag')[0].kind).toBe('paragraph');
  });

  it('keeps a fenced block as typed, closed or not', () => {
    expect(parseMarkdown('```alphatex\n:4 0.6 <b>|\n  3.5\n```\nAfter')).toEqual([
      { kind: 'code', lang: 'alphatex', text: ':4 0.6 <b>|\n  3.5' },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'After' }] },
    ]);
    expect(parseMarkdown('~~~\nnever closed')).toEqual([{ kind: 'code', lang: '', text: 'never closed' }]);
  });

  it('reads bulleted and numbered lists, a list straight after a line, and a start number', () => {
    const [intro, list] = parseMarkdown('Changes:\n- bar 1\n* bar 2');
    expect(intro.kind).toBe('paragraph');
    expect(list).toMatchObject({ kind: 'list', ordered: false, items: [[{ inlines: [{ text: 'bar 1' }] }], [{ inlines: [{ text: 'bar 2' }] }]] });
    expect(parseMarkdown('3. three\n4. four')[0]).toMatchObject({ kind: 'list', ordered: true, start: 3 });
  });

  it('nests a list indented under an item, even two spaces under "1."', () => {
    const [list] = parseMarkdown('1. Verse\n  - bars 1 to 4\n  - bars 5 to 8\n2. Chorus');
    expect(list).toMatchObject({ kind: 'list', ordered: true });
    if (list.kind !== 'list') throw new Error();
    expect(list.items).toHaveLength(2);
    expect(list.items[0][1]).toMatchObject({ kind: 'list', ordered: false, items: [[{}], [{}]] });
  });

  it('keeps a list going over blank lines between items, and ends it at an unindented paragraph', () => {
    const blocks = parseMarkdown('- one\n\n- two\n\n  more of two\n\nAfter');
    expect(blocks.map(b => b.kind)).toEqual(['list', 'paragraph']);
    if (blocks[0].kind !== 'list') throw new Error();
    expect(blocks[0].items[1].map(b => b.kind)).toEqual(['paragraph', 'paragraph']);
  });

  it('reads "- - -" and "***" as rules, not lists or emphasis', () => {
    expect(parseMarkdown('- - -')).toEqual([{ kind: 'rule' }]);
    expect(parseMarkdown('***')).toEqual([{ kind: 'rule' }]);
  });

  it('reads quotes, with markdown inside', () => {
    expect(parseMarkdown('> **Tip:** mute\n> the low E')[0]).toMatchObject({
      kind: 'quote', blocks: [{ kind: 'paragraph', inlines: [{ kind: 'strong' }, { text: ' mute' }, { kind: 'break' }, { text: 'the low E' }] }],
    });
  });

  it('reads a table with alignment, short rows padded and pipes in code kept', () => {
    const [table] = parseMarkdown('| Bar | Chord | Note |\n|:---|:---:|---:|\n| 1 | Am |\n| 2 | `a|b` | x \\| y |');
    expect(table).toMatchObject({ kind: 'table', align: ['left', 'center', 'right'] });
    if (table.kind !== 'table') throw new Error();
    expect(table.rows).toHaveLength(2);
    expect(table.rows[0][2]).toEqual([]);
    expect(table.rows[1][1]).toEqual([{ kind: 'code', text: 'a|b' }]);
    expect(table.rows[1][2]).toEqual([{ kind: 'text', text: 'x | y' }]);
  });

  it('leaves a line with a pipe but no delimiter row as a paragraph', () => {
    expect(parseMarkdown('A | B')[0].kind).toBe('paragraph');
  });
});

describe('parseInlines', () => {
  it('reads strong, em, both, and strikethrough', () => {
    expect(parseInlines('**a** *b* ***c*** ~~d~~ __e__ _f_')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'a' }] }, { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'b' }] }, { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'em', children: [{ kind: 'text', text: 'c' }] }] }, { kind: 'text', text: ' ' },
      { kind: 'del', children: [{ kind: 'text', text: 'd' }] }, { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'e' }] }, { kind: 'text', text: ' ' },
      { kind: 'em', children: [{ kind: 'text', text: 'f' }] },
    ]);
  });

  it('nests emphasis', () => {
    expect(parseInlines('*a **b** c*')).toEqual([{ kind: 'em', children: [
      { kind: 'text', text: 'a ' }, { kind: 'strong', children: [{ kind: 'text', text: 'b' }] }, { kind: 'text', text: ' c' },
    ] }]);
  });

  it('leaves snake_case, lone stars, "2 * 3 * 4" and unclosed runs as typed', () => {
    for (const text of ['read_arrangement and replace_bars', 'a * b', '2 * 3 * 4', '**open', 'x~y']) {
      expect(parseInlines(text)).toEqual([{ kind: 'text', text }]);
    }
  });

  it('reads code spans, which hide markdown, and escapes', () => {
    expect(parseInlines('`**x**` and `` a`b ``')).toEqual([
      { kind: 'code', text: '**x**' }, { kind: 'text', text: ' and ' }, { kind: 'code', text: 'a`b' },
    ]);
    expect(parseInlines('\\*not em\\*')).toEqual([{ kind: 'text', text: '*not em*' }]);
  });

  it('reads only bold for a Tab Text (boldOnly, issue #446): italics, code, strike, links and new lines as typed', () => {
    expect(parseInlines('**a** *b* `c` ~~d~~ [e](https://example.com)\nf', { boldOnly: true })).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'a' }] },
      { kind: 'text', text: ' *b* `c` ~~d~~ [e](https://example.com)\nf' },
    ]);
    // Only a star, an underscore or a backslash is escaped; any other backslash is a letter.
    expect(parseInlines('\\* \\_ \\\\ \\(', { boldOnly: true })).toEqual([{ kind: 'text', text: '* _ \\ \\(' }]);
  });

  it('links http, https and mailto, with a title or emphasis in the label', () => {
    expect(parseInlines('[**docs**](https://example.com/a_(b) "Title")')).toEqual([
      { kind: 'link', href: 'https://example.com/a_(b)', children: [{ kind: 'strong', children: [{ kind: 'text', text: 'docs' }] }] },
    ]);
    expect(parseInlines('[mail](mailto:a@b.c)')[0]).toMatchObject({ kind: 'link', href: 'mailto:a@b.c' });
  });

  it('keeps only the words of a link to javascript:, data: or a relative path', () => {
    for (const href of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<b>x</b>', '/tab', 'vbscript:x']) {
      expect(parseInlines(`[click](${href})`)).toEqual([{ kind: 'text', text: 'click' }]);
    }
  });

  it('shows an image as a link to it, never the picture', () => {
    expect(parseInlines('![chart](https://example.com/c.png)')).toEqual([
      { kind: 'link', href: 'https://example.com/c.png', children: [{ kind: 'text', text: 'chart' }] },
    ]);
  });

  it('links bare and <angle> addresses, leaving the sentence\'s punctuation and an unopened ")" outside', () => {
    expect(parseInlines('See https://frets.eminor.net/tab.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'link', href: 'https://frets.eminor.net/tab', children: [{ kind: 'text', text: 'https://frets.eminor.net/tab' }] },
      { kind: 'text', text: '.' },
    ]);
    expect(parseInlines('(at https://x.org/a)')[1]).toMatchObject({ href: 'https://x.org/a' });
    expect(parseInlines('<https://x.org>')[0]).toMatchObject({ kind: 'link', href: 'https://x.org/' });
  });

  it('safeHref accepts only http, https and mailto', () => {
    expect(safeHref('https://a.b/c')).toBe('https://a.b/c');
    expect(safeHref(' javascript:alert(1)')).toBeNull();
    expect(safeHref('ftp://a.b')).toBeNull();
    expect(safeHref('not a url')).toBeNull();
  });
});

describe('ReplyMarkdown', () => {
  it('shows raw HTML as text, never as markup', () => {
    const out = html('<img src=x onerror="alert(1)"> <script>alert(2)</script> <b>bold</b>');
    expect(out).not.toMatch(/<img|<script|<b>/);
    expect(out).toContain('&lt;img src=x onerror="alert(1)"&gt;');
    expect(out).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('opens links in a new tab, without the opener', () => {
    const { container } = render(<ReplyMarkdown text="[Frets](https://frets.eminor.net)" />);
    const a = container.querySelector('a')!;
    expect(a.getAttribute('href')).toBe('https://frets.eminor.net/');
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('gives no link for a javascript: address', () => {
    expect(html('[x](javascript:alert(1))')).toBe('<p>x</p>');
  });

  it('draws each block as its element', () => {
    const out = html('## Plan\n\n1. **Bar 1**: `0.6`\n2. Bar 2\n\n> quote\n\n---\n\n```\ncode <x>\n```\n\n| A | B |\n|---|--:|\n| 1 | 2 |');
    expect(out).toContain('<h3>Plan</h3>');
    expect(out).toContain('<ol><li><p><strong>Bar 1</strong>: <code>0.6</code></p></li><li><p>Bar 2</p></li></ol>');
    expect(out).toContain('<blockquote><p>quote</p></blockquote>');
    expect(out).toContain('<hr>');
    expect(out).toContain('<pre><code>code &lt;x&gt;</code></pre>');
    expect(out).toContain('<div class="tab-chat-table"><table><thead><tr><th>A</th><th style="text-align: right;">B</th></tr></thead>');
  });

  it('starts a numbered list at its first number', () => {
    expect(html('5. five')).toBe('<ol start="5"><li><p>five</p></li></ol>');
  });
});
