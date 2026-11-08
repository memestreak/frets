/**
 * A Chat reply's markdown as elements (issue #427). Built from `parseMarkdown`'s blocks, never from
 * HTML, so nothing a model writes can become markup; links open in a new tab.
 */
import type { ReactNode } from 'react';
import { parseMarkdown, type Block, type Inline } from './markdown';

export function ReplyMarkdown({ text }: { text: string }) {
  return <div className="tab-chat-text">{parseMarkdown(text).map(renderBlock)}</div>;
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.kind) {
    case 'paragraph':
      return <p key={key}>{renderInlines(block.inlines)}</p>;
    case 'heading': {
      // Small headings inside the panel; the page keeps its own outline above them.
      const Tag = block.level <= 2 ? 'h3' : 'h4';
      return <Tag key={key}>{renderInlines(block.inlines)}</Tag>;
    }
    case 'code':
      return <pre key={key} data-lang={block.lang || undefined}><code>{block.text}</code></pre>;
    case 'list': {
      const items = block.items.map((item, i) => <li key={i}>{item.map(renderBlock)}</li>);
      return block.ordered
        ? <ol key={key} start={block.start === 1 ? undefined : block.start}>{items}</ol>
        : <ul key={key}>{items}</ul>;
    }
    case 'quote':
      return <blockquote key={key}>{block.blocks.map(renderBlock)}</blockquote>;
    case 'rule':
      return <hr key={key} />;
    case 'table':
      return (
        <div key={key} className="tab-chat-table">
          <table>
            <thead>
              <tr>{block.head.map((cell, c) => <th key={c} style={{ textAlign: block.align[c] ?? undefined }}>{renderInlines(cell)}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>{row.map((cell, c) => <td key={c} style={{ textAlign: block.align[c] ?? undefined }}>{renderInlines(cell)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

function renderInlines(inlines: Inline[]): ReactNode[] {
  return inlines.map((inline, key) => {
    switch (inline.kind) {
      case 'text': return inline.text;
      case 'break': return <br key={key} />;
      case 'code': return <code key={key}>{inline.text}</code>;
      case 'strong': return <strong key={key}>{renderInlines(inline.children)}</strong>;
      case 'em': return <em key={key}>{renderInlines(inline.children)}</em>;
      case 'del': return <del key={key}>{renderInlines(inline.children)}</del>;
      case 'link': return <a key={key} href={inline.href} target="_blank" rel="noopener noreferrer">{renderInlines(inline.children)}</a>;
    }
  });
}
