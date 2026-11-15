'use client';

/**
 * The Chat panel's advanced view of one reply (issue #495): every model call it made, each with what was
 * sent (the model, the headers with the key masked, the system prompt, every message, the tools, the raw
 * JSON), what came back (the text, each tool call with its arguments, the usage, the raw JSON) and what
 * each tool answered. Every section starts folded, and a folded section draws nothing inside it, so a long
 * conversation costs nothing until opened.
 */
import { useState, type ReactNode } from 'react';
import type { ChatMessage } from './openRouter';
import type { CallRecord } from './reply';
import { callHeading, messageHeading, messageText, shownArguments, shownJson } from './advanced';

export function CallDetails({ calls }: { calls: readonly CallRecord[] }) {
  if (calls.length === 0) return null;
  return (
    <Fold className="tab-chat-calls" title={`Requests and responses (${calls.length} ${calls.length === 1 ? 'call' : 'calls'})`}>
      {calls.map((call, i) => (
        <Fold key={i} title={callHeading(call, i)} failed={!!call.error}>
          <Request call={call} />
          <ResponsePart call={call} />
          {call.results.length > 0 && (
            <Fold title={`Tool results (${call.results.length})`}>
              {call.results.map(({ call: toolCall, answer, failed }, j) => (
                <Fold key={j} title={`${toolCall.function.name}${failed ? ' · failed' : ''}`} failed={failed}>
                  <Field name="Call id">{toolCall.id}</Field>
                  <Fold title="Arguments"><Pre text={shownArguments(toolCall.function.arguments)} /></Fold>
                  <Fold title="Answer"><Pre text={answer} /></Fold>
                </Fold>
              ))}
            </Fold>
          )}
        </Fold>
      ))}
    </Fold>
  );
}

function Request({ call }: { call: CallRecord }) {
  const { messages, tools, model } = call.request;
  const system = messages[0]?.role === 'system' ? messages[0] : null;
  const rest = system ? messages.slice(1) : messages;
  const offset = system ? 1 : 0;
  return (
    <Fold title="Request">
      <Field name="Model">{model}</Field>
      {call.exchange && <Field name="URL">{call.exchange.url}</Field>}
      {call.exchange && <Fold title="Headers"><Pre text={shownJson(call.exchange.headers)} /></Fold>}
      {system && <Fold title={`System prompt (${system.content.length.toLocaleString('en')} characters)`}><Pre text={system.content} /></Fold>}
      <Fold title={`Messages (${rest.length})`}>
        {rest.map((message, i) => (
          <Fold key={i} title={messageHeading(message)} isNew={i + offset >= call.newFrom}>
            <Message message={message} />
          </Fold>
        ))}
      </Fold>
      <Fold title={`Tools (${tools.length})`}>
        {tools.map(tool => (
          <Fold key={tool.function.name} title={tool.function.name}>
            <p className="tab-chat-field-text">{tool.function.description}</p>
            <Fold title="Parameters"><Pre text={shownJson(tool.function.parameters)} /></Fold>
          </Fold>
        ))}
      </Fold>
      <RawJson value={call.exchange?.body ?? call.request} />
    </Fold>
  );
}

function ResponsePart({ call }: { call: CallRecord }) {
  const { answer, exchange, usage, error } = call;
  if (!answer && !error) return <p className="tab-chat-field-text">Waiting for the response…</p>;
  return (
    <Fold title={error ? 'Response · failed' : 'Response'} failed={!!error}>
      {exchange?.status !== undefined && <Field name="Status">{String(exchange.status)}</Field>}
      {call.model && <Field name="Model">{call.model}</Field>}
      {error && <p className="tab-chat-field-text" data-failed>{error}</p>}
      {answer && <Message message={answer} />}
      {usage && (
        <Fold title="Usage">
          <Field name="Prompt tokens">{numberText(usage.promptTokens)}</Field>
          <Field name="Cached tokens">{numberText(usage.cachedTokens)}</Field>
          <Field name="Completion tokens">{numberText(usage.completionTokens)}</Field>
          <Field name="Cost">{usage.cost === undefined ? '–' : `$${usage.cost.toFixed(6)}`}</Field>
        </Fold>
      )}
      {exchange?.response !== undefined && <RawJson value={exchange.response} />}
    </Fold>
  );
}

/** A message's parts: its text, its tool calls and, for a tool's answer, which call it answers. */
function Message({ message }: { message: ChatMessage }) {
  const text = messageText(message);
  return (
    <>
      {message.role === 'tool' && <Field name="Answers call">{message.tool_call_id}</Field>}
      {text ? <Pre text={text} /> : <p className="tab-chat-field-text">(No text)</p>}
      {message.role === 'assistant' && message.tool_calls?.map(toolCall => (
        <Fold key={toolCall.id} title={`Tool call · ${toolCall.function.name}`}>
          <Field name="Call id">{toolCall.id}</Field>
          <Pre text={shownArguments(toolCall.function.arguments)} />
        </Fold>
      ))}
    </>
  );
}

/** The raw JSON, images shortened; Copy copies it whole, images and all. */
function RawJson({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }, () => {});
  };
  return (
    <Fold title="Raw JSON">
      <div className="tab-chat-raw-actions">
        <button type="button" className="tab-chat-link" onMouseDown={e => e.preventDefault()} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <Pre text={shownJson(value)} />
    </Fold>
  );
}

/**
 * A folded section. Its insides are drawn only while it is open, and it stays open or folded as the
 * viewer left it while the reply is on screen.
 */
function Fold({ title, children, className, failed, isNew }: {
  title: string; children: ReactNode; className?: string; failed?: boolean; isNew?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className ?? 'tab-chat-fold'} open={open} data-failed={failed || undefined}
      onToggle={e => setOpen(e.currentTarget.open)}
    >
      <summary>
        <span className="tab-chat-fold-title">{title}</span>
        {isNew && <span className="tab-chat-new">new</span>}
      </summary>
      {open && <div className="tab-chat-fold-body">{children}</div>}
    </details>
  );
}

function Field({ name, children }: { name: string; children: ReactNode }) {
  return <p className="tab-chat-field"><span>{name}</span> {children}</p>;
}

function Pre({ text }: { text: string }) {
  return <pre className="tab-chat-pre">{text}</pre>;
}

function numberText(n: number | undefined): string {
  return n === undefined ? '–' : n.toLocaleString('en');
}
