'use client';

/**
 * A volume or level: a small rotary knob (Jeremy picked it over a slider, 2026-10-26).
 * Drag up or down, scroll, or use the arrow keys to turn it; it sweeps 270°, from 0 at lower left
 * to 100% at lower right, with the level on hover. With `reset`, a double-click puts that level back.
 */
import { useEffect, useRef } from 'react';
import { letGoOfFields } from '@/hooks/useLetGoAfterUse';

/** The knob's size, its sweep, and how far a drag, a key or a scroll turns it. */
const SIZE = 32;
const SWEEP = 270;
const DRAG_PX_PER_FULL = 150;
const STEP = 0.05;

/** The point on a circle round the knob's centre at a turn of 0 (lowest) to 1 (highest). */
function pointAt(turn: number, radius: number): [number, number] {
  const degrees = -SWEEP / 2 + turn * SWEEP;
  const radians = (degrees - 90) * (Math.PI / 180);
  return [SIZE / 2 + radius * Math.cos(radians), SIZE / 2 + radius * Math.sin(radians)];
}

/** An arc round the knob from one turn to another. */
function arc(from: number, to: number, radius: number): string {
  const [x0, y0] = pointAt(from, radius);
  const [x1, y1] = pointAt(to, radius);
  const large = (to - from) * SWEEP > 180 ? 1 : 0;
  return `M${x0} ${y0} A${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function VolumeKnob({ value, onChange, labelledBy, name = 'Volume', reset, disabled = false }: {
  /** 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  labelledBy: string;
  /** What it turns, named in its tip; the FX dialog's knobs share it (Drive, Tone, Amount). */
  name?: string;
  /** What a double-click puts back (the Metronome's knobs: 100%). */
  reset?: number;
  /** Shown greyed, and turned by nothing. */
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; value: number } | null>(null);
  // The latest value and handler, for the scroll listener added once.
  const latest = useRef({ value, onChange, disabled });
  useEffect(() => {
    latest.current = { value, onChange, disabled };
  });

  // Scrolling turns the knob instead of the page; React's wheel listener can't stop the scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { value: now, onChange: change, disabled: off } = latest.current;
      if (off) return;
      e.preventDefault();
      change(clamp(Math.round((now + (e.deltaY < 0 ? STEP : -STEP)) * 100) / 100));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const percent = Math.round(value * 100);
  const text = `${percent}%`;
  const [dotX, dotY] = pointAt(value, 9);
  const [tipX, tipY] = pointAt(value, 4);
  return (
    <div
      ref={ref} className="knob" role="slider" tabIndex={disabled ? -1 : 0} aria-labelledby={labelledBy}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={text}
      aria-disabled={disabled || undefined} data-disabled={disabled || undefined}
      data-tip={`${name} ${text}${reset !== undefined && !disabled ? ` (double-click: ${Math.round(reset * 100)}%)` : ''}`}
      // A press leaves the focus (and so the cursor) on the tab; the keys still reach the knob by Tab.
      onMouseDown={e => e.preventDefault()}
      onPointerDown={e => {
        if (disabled) return;
        letGoOfFields();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { y: e.clientY, value };
      }}
      onPointerMove={e => {
        if (!drag.current) return;
        // Up turns it up.
        onChange(clamp(drag.current.value + (drag.current.y - e.clientY) / DRAG_PX_PER_FULL));
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onDoubleClick={() => {
        if (reset !== undefined && !disabled) onChange(reset);
      }}
      onKeyDown={e => {
        if (disabled) return;
        const by = { ArrowUp: STEP, ArrowRight: STEP, ArrowDown: -STEP, ArrowLeft: -STEP }[e.key];
        if (by !== undefined) onChange(clamp(Math.round((value + by) * 100) / 100));
        else if (e.key === 'Home') onChange(0);
        else if (e.key === 'End') onChange(1);
        else return;
        e.preventDefault();
      }}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        {/* The track round the knob, and the part turned up. */}
        <path d={arc(0, 1, 14)} fill="none" stroke="var(--surface-sunken)" strokeWidth={3} strokeLinecap="round" />
        {value > 0 && <path d={arc(0, value, 14)} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" />}
        <circle cx={SIZE / 2} cy={SIZE / 2} r={10.5} fill="var(--surface-raised)" stroke="var(--line-strong)" strokeWidth={1.5} />
        <line x1={tipX} y1={tipY} x2={dotX} y2={dotY} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" />
      </svg>
    </div>
  );
}
