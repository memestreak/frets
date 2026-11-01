'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon } from '@/components/icons';

/** A connector's URL, and a button that copies it to paste into the chat app. */
export function ConnectorActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The browser refused: the URL is on the card to copy by hand.
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="mr-2 break-all">{url}</code>
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />} Copy
      </button>
    </div>
  );
}
