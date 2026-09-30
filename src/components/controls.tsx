import type { ReactNode } from 'react';

/** Small bordered key hint, e.g. "↵" or "H". */
export function Keycap({ children }: { children: ReactNode }) {
  return <span className="keycap" aria-hidden="true">{children}</span>;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
}

/** `.seg` segmented control; the active option is filled with the accent. */
export function Segmented<T extends string>(
  { label, options, value, onChange }: SegmentedProps<T>,
) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          className="seg-opt"
          aria-pressed={v === value}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

interface ToggleButtonProps {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  'aria-label'?: string;
}

/** Secondary button with an on state (accent-100 fill, accent border). */
export function ToggleButton(
  { pressed, onClick, children, className = '', ...rest }: ToggleButtonProps,
) {
  return (
    <button
      type="button"
      className={`btn btn-secondary btn-toggle ${className}`}
      aria-pressed={pressed}
      onClick={onClick}
      {...rest}
    >
      {children}
    </button>
  );
}
