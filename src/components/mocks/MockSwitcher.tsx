'use client';

/**
 * The mock switcher (`docs/specs/2026-11-01-mock-switcher-design.md`): a small card pinned to the
 * bottom right, shown only when the link names one of the page's mocks (`useMock`). Each mock is a
 * row of options; pressing one switches the page in place. Its title folds it to one line.
 * Mounted once by `AppShell`.
 */
import { useState } from 'react';
import { chosen, setMock, useShownMocks } from './useMock';

export function MockSwitcher() {
  const { mocks, search } = useShownMocks();
  const [folded, setFolded] = useState(false);
  if (mocks.length === 0) return null;
  return (
    <aside className="mock-switcher" aria-label="Mocks">
      <button type="button" className="mock-switcher-title" aria-expanded={!folded} onClick={() => setFolded(f => !f)}>
        Mock
        {folded && <span className="mock-switcher-summary">{mocks.map(m => optionLabel(m, chosen(m, search))).join(' · ')}</span>}
        <span aria-hidden="true" className="mock-switcher-fold">{folded ? '▴' : '▾'}</span>
      </button>
      {!folded && mocks.map(mock => {
        const current = chosen(mock, search);
        return (
          <div key={mock.param} className="mock-switcher-row">
            <span className="mock-switcher-label" id={`mock-${mock.param}`}>{mock.label}</span>
            <div className="seg" role="group" aria-labelledby={`mock-${mock.param}`}>
              {mock.options.map(option => (
                <button
                  key={option.value} type="button" className="seg-opt" aria-pressed={option.value === current}
                  title={`?${mock.param}=${option.value}`} onClick={() => setMock(mock, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function optionLabel(mock: { options: readonly { value: string; label: string }[] }, value: string) {
  return mock.options.find(o => o.value === value)?.label ?? value;
}
