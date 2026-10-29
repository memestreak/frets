'use client';

import { useState } from 'react';
import { CheckIcon, CopyIcon, SaveIcon } from '@/components/icons';

/** A skill's link to read it in the browser, and buttons that copy its text and save it as SKILL.md. */
export function SkillActions({ skill }: { skill: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      // A ClipboardItem built from the fetch keeps the click's permission in Safari, which a write after an await loses.
      const text = fetch(skill).then(r => r.text());
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': text.then(t => new Blob([t], { type: 'text/plain' })) }),
        ]);
      } else {
        await navigator.clipboard.writeText(await text);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // The browser refused: View skill shows the text to copy by hand.
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={skill} target="_blank" rel="noreferrer" className="mr-2">View skill</a>
      <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
        {copied ? <CheckIcon /> : <CopyIcon />} Copy
      </button>
      <a href={skill} download="SKILL.md" className="btn btn-secondary text-inherit no-underline">
        <SaveIcon /> Download
      </a>
    </div>
  );
}
