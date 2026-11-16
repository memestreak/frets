import { describe, expect, it } from 'vitest';
import { entryTitle, forModel, megabytes, pretty, sections, tokens } from '../../../mcp/preview/format';

/* How the stand-in host's log (mcp/preview/) shows each MCP message. */

const titles = (message: Record<string, unknown>) => sections(message, 72).map(s => s.title);

describe('sections', () => {
  it('splits a tools/call result into its text, its structured data, then host-only _meta', () => {
    const result = {
      content: [{ type: 'text', text: 'A C major scale, one octave.' }],
      structuredContent: { bpm: 90 },
      _meta: { 'ui/resourceUri': 'ui://frets/tab.html' },
    };
    expect(sections(result, 72)).toEqual([
      { title: 'Text (content)', body: 'A C major scale, one octave.' },
      { title: 'Structured data (structuredContent)', body: '{"bpm":90}' },
      { title: 'Host only (_meta), not sent to the model', body: '{"ui/resourceUri":"ui://frets/tab.html"}' },
    ]);
  });

  it('shows content that is not text as JSON', () => {
    const [text] = sections({ content: [{ type: 'text', text: 'one' }, { type: 'image', data: 'AAA' }] }, 72);
    expect(text.body).toBe('one\n\n{"type":"image","data":"AAA"}');
  });

  it('shows a resources/read entry as one Message section, with _meta last', () => {
    const read = { uri: 'ui://frets/tab.html', mimeType: 'text/html;profile=mcp-app', size: '4.0 MB', _meta: { ui: { prefersBorder: false } } };
    expect(sections(read, 72)).toEqual([
      { title: 'Message', body: '{\n  "uri": "ui://frets/tab.html",\n  "mimeType": "text/html;profile=mcp-app",\n  "size": "4.0 MB"\n}' },
      { title: 'Host only (_meta), not sent to the model', body: '{"ui":{"prefersBorder":false}}' },
    ]);
  });

  it("splits a tool from tools/list into its description and input schema, then the rest as Also", () => {
    const tool = { name: 'show_tab', description: 'Shows a line.', inputSchema: { type: 'object' }, _meta: { ui: {} } };
    expect(titles(tool)).toEqual(['Description', 'Input schema (inputSchema)', 'Also', 'Host only (_meta), not sent to the model']);
    expect(sections(tool, 72)[2].body).toBe('{"name":"show_tab"}');
  });

  it('shows the server instructions as their own text', () => {
    expect(sections({ instructions: 'Frets is a guitar app.' }, 72)).toEqual([{ title: 'Instructions', body: 'Frets is a guitar app.' }]);
  });

  it('leaves out undefined fields, and has no _meta section without _meta', () => {
    expect(sections({ content: [], extra: undefined }, 72)).toEqual([{ title: 'Text (content)', body: '' }]);
  });
});

describe('pretty', () => {
  it('keeps what fits in the width on one line', () => {
    expect(pretty({ a: 1, b: [1, 2] })).toBe('{"a":1,"b":[1,2]}');
  });

  it('breaks what does not fit, keeping each part that fits on one line', () => {
    const value = { notes: [{ string: 1, fret: 0 }, { string: 2, fret: 3 }], title: 'x'.repeat(20) };
    expect(pretty(value, 30)).toBe([
      '{',
      '  "notes": [',
      '    {"string":1,"fret":0},',
      '    {"string":2,"fret":3}',
      '  ],',
      `  "title": "${'x'.repeat(20)}"`,
      '}',
    ].join('\n'));
  });

  it('leaves out undefined fields when it breaks an object', () => {
    expect(pretty({ a: 'x'.repeat(10), b: undefined }, 5)).toBe('{\n  "a": "xxxxxxxxxx"\n}');
  });
});

describe('the small helpers', () => {
  it('forModel drops _meta and keeps the rest', () => {
    const message = { content: [], _meta: { ui: {} } };
    expect(forModel(message)).toEqual({ content: [] });
    expect(message._meta).toBeDefined();
  });

  it('entryTitle, tokens and megabytes', () => {
    expect(entryTitle('tools/call', 'show_tab #2')).toBe('tools/call · show_tab #2');
    expect(tokens('x'.repeat(398))).toBe('~100 tokens');
    expect(megabytes('é'.repeat(2_000_000))).toBe('4.0 MB');
  });
});
