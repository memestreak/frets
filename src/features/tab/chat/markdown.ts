/**
 * The markdown a model writes in a Chat reply, read into blocks and inlines (issue #427). Only what
 * chat replies use: paragraphs, headings, emphasis, code, lists, quotes, rules, tables and links.
 * Raw HTML is never markup here: it stays text, and React shows text as text. A link is a link only
 * when its address is http, https or mailto; any other (javascript:, a relative path) leaves its words.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong' | 'em' | 'del'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }
  | { kind: 'break' };

export type Align = 'left' | 'center' | 'right' | null;

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'code'; lang: string; text: string }
  | { kind: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'rule' }
  | { kind: 'table'; align: Align[]; head: Inline[][]; rows: Inline[][][] };

// ---------------------------------------------------------------- blocks

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/;
const RULE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const ITEM = /^( *)([-*+]|\d{1,9}[.)])(?:\s+(.*))?$/;
const TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

/** The reply's text as blocks. */
export function parseMarkdown(text: string): Block[] {
  return parseBlocks(text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n'));
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    const fence = FENCE.exec(line);
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}\\s*$`);
      const body: string[] = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence, or past the end when the model never closed it
      blocks.push({ kind: 'code', lang: fence[2], text: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInlines(heading[2] ?? '') });
      i++;
      continue;
    }

    // Before lists, since "- - -" and "* * *" are rules.
    if (RULE.test(line)) { blocks.push({ kind: 'rule' }); i++; continue; }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) inner.push(QUOTE.exec(lines[i++])![1]);
      blocks.push({ kind: 'quote', blocks: parseBlocks(inner) });
      continue;
    }

    if (ITEM.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_DELIMITER.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map(alignOf);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        const cells = splitRow(lines[i++]);
        rows.push(head.map((_, c) => parseInlines(cells[c] ?? '')));
      }
      blocks.push({ kind: 'table', align: head.map((_, c) => align[c] ?? null), head: head.map(cell => parseInlines(cell)), rows });
      continue;
    }

    // A paragraph runs to a blank line or the start of another block.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && (para.length === 0 || !startsBlock(lines[i]))) {
      para.push(lines[i++].trim());
    }
    blocks.push({ kind: 'paragraph', inlines: parseInlines(para.join('\n')) });
  }
  return blocks;
}

function startsBlock(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || RULE.test(line) || QUOTE.test(line) || ITEM.test(line);
}

/**
 * A list from line `from`: each item's lines, its first without the marker, the rest without the
 * indent up to its words. A line indented past the marker belongs to the item, so a nested list
 * indented two spaces under "1." still nests.
 */
function parseList(lines: string[], from: number): { block: Block; next: number } {
  const first = ITEM.exec(lines[from])!;
  const indent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items: string[][] = [];
  let i = from;
  let contentIndent = 0;
  while (i < lines.length) {
    const line = lines[i];
    const item = ITEM.exec(line);
    if (item && item[1].length === indent && /\d/.test(item[2]) === ordered && !RULE.test(line)) {
      items.push([item[3] ?? '']);
      contentIndent = indent + item[2].length + 1;
      i++;
      continue;
    }
    const lineIndent = line.length - line.trimStart().length;
    if (line.trim() === '') {
      // A blank line ends the list unless what follows still belongs to it.
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j++;
      if (j >= lines.length) break;
      const after = lines[j];
      const afterItem = ITEM.exec(after);
      const sameList = afterItem && afterItem[1].length === indent && /\d/.test(afterItem[2]) === ordered;
      const nested = after.length - after.trimStart().length > indent;
      if (!sameList && !nested) break;
      items[items.length - 1].push('');
      i++;
      continue;
    }
    if (lineIndent > indent) {
      items[items.length - 1].push(line.slice(Math.min(lineIndent, contentIndent)));
      i++;
      continue;
    }
    // An unindented line that starts nothing new carries on the item's paragraph.
    const last = items[items.length - 1];
    if (!startsBlock(line) && last[last.length - 1].trim() !== '') { last.push(line); i++; continue; }
    break;
  }
  return {
    block: { kind: 'list', ordered, start: ordered ? parseInt(first[2], 10) : 1, items: items.map(parseBlocks) },
    next: i,
  };
}

/** A table row's cells: split at pipes not escaped or inside `code`, the outer pipes dropped. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inCode = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '\\' && line[i + 1] === '|') { cell += '|'; i++; continue; }
    if (ch === '`') inCode = !inCode;
    if (ch === '|' && !inCode) { cells.push(cell); cell = ''; continue; }
    cell += ch;
  }
  cells.push(cell);
  if (cells.length > 1 && cells[0].trim() === '') cells.shift();
  if (cells.length > 1 && cells[cells.length - 1].trim() === '') cells.pop();
  return cells.map(c => c.trim());
}

function alignOf(cell: string): Align {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  return left && right ? 'center' : right ? 'right' : left ? 'left' : null;
}

// ---------------------------------------------------------------- inlines

const PUNCTUATION = /[!-/:-@[-`{-~]/;
const BARE_URL = /^(?:https?:\/\/|mailto:)[^\s<]+/;

/** The address, if it is one a link may go to: http, https or mailto. */
export function safeHref(href: string): string | null {
  try {
    const url = new URL(href.trim());
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/** One paragraph's or cell's text as inlines; a newline is a line break, as the plain reply showed it. */
export function parseInlines(text: string, inLink = false): Inline[] {
  const out: Inline[] = [];
  let plain = '';
  const flush = () => { if (plain) { out.push({ kind: 'text', text: plain }); plain = ''; } };
  const push = (inline: Inline) => { flush(); out.push(inline); };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const rest = text.slice(i);

    if (ch === '\\' && i + 1 < text.length && PUNCTUATION.test(text[i + 1])) { plain += text[i + 1]; i += 2; continue; }
    if (ch === '\n') { push({ kind: 'break' }); i++; continue; }

    if (ch === '`') {
      const run = /^`+/.exec(rest)![0];
      const end = text.indexOf(run, i + run.length);
      // A longer run of backticks isn't a closer for this one.
      if (end !== -1 && text[end + run.length] !== '`') {
        let code = text.slice(i + run.length, end).replace(/\n/g, ' ');
        if (code.length > 2 && code.startsWith(' ') && code.endsWith(' ')) code = code.slice(1, -1);
        push({ kind: 'code', text: code });
        i = end + run.length;
        continue;
      }
      plain += run;
      i += run.length;
      continue;
    }

    if (!inLink && (ch === '[' || (ch === '!' && text[i + 1] === '['))) {
      const link = readLink(text, ch === '!' ? i + 1 : i);
      if (link) {
        const href = safeHref(link.href);
        const children = parseInlines(link.label, true);
        // An image is shown as a link to it: the panel never loads pictures from a reply.
        if (href) push({ kind: 'link', href, children: children.length ? children : [{ kind: 'text', text: href }] });
        else { flush(); out.push(...children); }
        i = link.end;
        continue;
      }
    }

    if (!inLink && ch === '<') {
      const auto = /^<((?:https?:\/\/|mailto:)[^\s<>]+)>/.exec(rest);
      const href = auto && safeHref(auto[1]);
      if (auto && href) { push({ kind: 'link', href, children: [{ kind: 'text', text: auto[1] }] }); i += auto[0].length; continue; }
    }

    if (!inLink && (ch === 'h' || ch === 'm') && !/\w/.test(text[i - 1] ?? '')) {
      const bare = BARE_URL.exec(rest);
      if (bare) {
        const url = trimUrl(bare[0]);
        const href = safeHref(url);
        if (href) { push({ kind: 'link', href, children: [{ kind: 'text', text: url }] }); i += url.length; continue; }
      }
    }

    if (ch === '*' || ch === '_' || ch === '~') {
      const emphasis = readEmphasis(text, i);
      if (emphasis) { push(emphasis.inline); i = emphasis.end; continue; }
      // An unmatched run stays as typed.
      const run = new RegExp(`^\\${ch}+`).exec(rest)![0];
      plain += run;
      i += run.length;
      continue;
    }

    plain += ch;
    i++;
  }
  flush();
  return out;
}

/** `[label](href "title")` at `at`, its parts and where it ends. */
function readLink(text: string, at: number): { label: string; href: string; end: number } | null {
  let depth = 0;
  let close = -1;
  for (let i = at; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '[') depth++;
    if (text[i] === ']' && --depth === 0) { close = i; break; }
  }
  if (close === -1 || text[close + 1] !== '(') return null;
  let parens = 0;
  for (let i = close + 2; i < text.length; i++) {
    if (text[i] === '(') parens++;
    if (text[i] === ')') {
      if (parens === 0) {
        const target = text.slice(close + 2, i).trim();
        const href = target.replace(/\s+(?:"[^"]*"|'[^']*')$/, '').replace(/^<(.*)>$/, '$1');
        if (/\s/.test(href)) return null;
        return { label: text.slice(at + 1, close), href, end: i + 1 };
      }
      parens--;
    }
    if (text[i] === '\n') return null;
  }
  return null;
}

/** A bare address without the punctuation that ends its sentence, or a ")" it didn't open. */
function trimUrl(url: string): string {
  let out = url.replace(/[.,;:!?'"*_~]+$/, '');
  while (out.endsWith(')') && (out.match(/\(/g)?.length ?? 0) < (out.match(/\)/g)?.length ?? 0)) {
    out = out.slice(0, -1).replace(/[.,;:!?'"*_~]+$/, '');
  }
  return out;
}

/**
 * Emphasis opening at `at`: `***x***`, `**x**` or `__x__` (strong), `*x*` or `_x_` (em), `~~x~~`
 * (del). The opener is followed by a non-space and the closer preceded by one; `_` never works
 * inside a word, so snake_case stays as typed.
 */
function readEmphasis(text: string, at: number): { inline: Inline; end: number } | null {
  const ch = text[at];
  const run = new RegExp(`^\\${ch}+`).exec(text.slice(at))![0];
  const tries: { delim: string; wrap: (children: Inline[]) => Inline }[] =
    ch === '~'
      ? [{ delim: '~~', wrap: children => ({ kind: 'del', children }) }]
      : [
          { delim: ch.repeat(3), wrap: children => ({ kind: 'strong', children: [{ kind: 'em', children }] }) },
          { delim: ch.repeat(2), wrap: children => ({ kind: 'strong', children }) },
          { delim: ch, wrap: children => ({ kind: 'em', children }) },
        ];
  for (const { delim, wrap } of tries) {
    if (run.length < delim.length) continue;
    const start = at + delim.length;
    // The opener takes its whole run: "**open" is never an empty em.
    if (start >= text.length || /\s/.test(text[start]) || text[start] === ch) continue;
    if (ch === '_' && /\w/.test(text[at - 1] ?? '')) return null;
    const end = findCloser(text, start, delim);
    if (end === -1) continue;
    return { inline: wrap(parseInlines(text.slice(start, end))), end: end + delim.length };
  }
  return null;
}

function findCloser(text: string, from: number, delim: string): number {
  const ch = delim[0];
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === '`') {
      // Code spans hide their contents from emphasis.
      const run = /^`+/.exec(text.slice(i))![0];
      const end = text.indexOf(run, i + run.length);
      if (end !== -1) { i = end + run.length - 1; continue; }
    }
    if (text[i] !== ch) continue;
    const run = new RegExp(`^\\${ch}+`).exec(text.slice(i))![0];
    const closes = run.length === delim.length;
    const afterOk = ch !== '_' || !/\w/.test(text[i + run.length] ?? '');
    if (closes && !/\s/.test(text[i - 1]) && afterOk) return i;
    // A longer or shorter run belongs to other emphasis inside: skip it whole.
    i += run.length - 1;
  }
  return -1;
}
