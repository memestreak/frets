'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';

/** A URL to hand an agent, with a button that copies it. */
export function CopyUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The browser refused: the URL is on screen to copy by hand.
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer" className="agent-url min-w-0 truncate">{url}</a>
      <button
        type="button" className="btn btn-secondary btn-icon shrink-0"
        aria-label="Copy link" title="Copy link" onClick={() => void copy()}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </div>
  );
}
