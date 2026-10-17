'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { TUNING } from '@/lib/music';
import { pitchLabel } from '@/features/practice/mic/pitch';
import { REF_SOUNDS, type RefSound } from '@/features/practice/mic/sounds';
import { strobeStep } from '@/features/practice/mic/tuner';
import { noteParts, STRINGS_DOWN, useTuner, type Tuner } from './useTuner';

/*
 * Design mocks for the /tuner page, picked with ?mock=a|b|c; &demo=1 plays
 * a simulated guitar instead of the mic. Not the final page.
 */

const MOCKS = [
  ['a', 'A · Dial'],
  ['b', 'B · On the neck'],
  ['c', 'C · Minimal'],
] as const;
type MockId = (typeof MOCKS)[number][0];

export default function TunerMocks() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('mock');
  const mock: MockId = raw === 'b' || raw === 'c' ? raw : 'a';
  const demo = params.get('demo') === '1';
  const tuner = useTuner(demo);
  const href = (m: MockId, d: boolean) => `/tuner?mock=${m}${d ? '&demo=1' : ''}`;

  return (
    <div className="grid gap-6">
      <nav className="mock-bar" aria-label="Mocks">
        <div className="seg">
          {MOCKS.map(([id, label]) => (
            <Link
              key={id} href={href(id, demo)} replace scroll={false} className="seg-opt"
              aria-current={id === mock ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </div>
        <button
          type="button" className="btn btn-secondary btn-toggle" aria-pressed={demo}
          onClick={() => router.replace(href(mock, !demo), { scroll: false })}
        >
          Simulate a guitar
        </button>
      </nav>
      {mock === 'a' && <DialMock t={tuner} />}
      {mock === 'b' && <NeckMock t={tuner} />}
      {mock === 'c' && <MinimalMock t={tuner} />}
    </div>
  );
}

function SoundSelect({ t, className = '' }: { t: Tuner; className?: string }) {
  return (
    <select
      className={`input w-auto ${className}`} aria-label="Reference sound" value={t.sound}
      onChange={e => t.setSound(e.target.value as RefSound)}
    >
      {REF_SOUNDS.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

/** The heard string's note, big, its octave small; a dash when nothing is heard. */
function BigNote({ t, className }: { t: Tuner; className: string }) {
  const parts = t.string == null ? null : noteParts(TUNING[t.string]);
  return (
    <span className={className} data-in-tune={t.inTune} data-idle={parts == null}>
      <span>{parts ? parts.name : '–'}</span>
      <sub>{parts?.octave ?? ''}</sub>
    </span>
  );
}

/* ── A · Dial ──────────────────────────────────────────────────────────── */

const DIAL = { cx: 160, cy: 172, r: 138 };
const MAX_CENTS = 50;
const SWEEP_DEG = 62;
const clampCents = (c: number) => Math.max(-MAX_CENTS, Math.min(MAX_CENTS, c));
const dialAngle = (c: number) => (clampCents(c) / MAX_CENTS) * SWEEP_DEG;
function dialPoint(c: number, r: number): [number, number] {
  const a = (dialAngle(c) * Math.PI) / 180;
  return [DIAL.cx + r * Math.sin(a), DIAL.cy - r * Math.cos(a)];
}
function arcPath(from: number, to: number, r: number): string {
  const [x1, y1] = dialPoint(from, r);
  const [x2, y2] = dialPoint(to, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
}
const TICKS = Array.from({ length: 21 }, (_, i) => i * 5 - 50);

function DialMock({ t }: { t: Tuner }) {
  const angle = t.cents == null ? 0 : dialAngle(t.cents);
  return (
    <section className="card tuner-a" aria-label="Tuner">
      <header className="tuner-a-head">
        <div>
          <h1 className="m-0">Tuner</h1>
          <p className="text-muted m-0 text-[13px]">Standard tuning · A440</p>
        </div>
        <SoundSelect t={t} />
      </header>

      <svg className="dial" viewBox="0 0 320 190" data-in-tune={t.inTune} aria-hidden="true">
        <path className="dial-track" d={arcPath(-50, 50, DIAL.r)} />
        <path className="dial-zone" d={arcPath(-5, 5, DIAL.r)} />
        {TICKS.map(c => {
          const major = c % 25 === 0;
          const [x1, y1] = dialPoint(c, DIAL.r - 10);
          const [x2, y2] = dialPoint(c, DIAL.r - (major ? 26 : 18));
          return (
            <line
              key={c} className={major ? 'dial-tick major' : 'dial-tick'}
              x1={x1} y1={y1} x2={x2} y2={y2}
            />
          );
        })}
        {[-50, -25, 25, 50].map(c => {
          const [x, y] = dialPoint(c, DIAL.r - 42);
          return (
            <text key={c} className="dial-label" x={x} y={y + 4}>
              {c > 0 ? `+${c}` : `−${-c}`}
            </text>
          );
        })}
        <text className="dial-flat" x={dialPoint(-50, DIAL.r)[0]} y={dialPoint(-50, DIAL.r)[1] + 36}>♭</text>
        <text className="dial-flat" x={dialPoint(50, DIAL.r)[0]} y={dialPoint(50, DIAL.r)[1] + 36}>♯</text>
        <g
          className="dial-needle" data-idle={t.cents == null}
          style={{ transform: `rotate(${angle}deg)` }}
        >
          <line x1={DIAL.cx} y1={DIAL.cy} x2={DIAL.cx} y2={DIAL.cy - DIAL.r + 4} />
        </g>
        <circle className="dial-hub" cx={DIAL.cx} cy={DIAL.cy} r="9" />
      </svg>

      <div className="tuner-a-readout">
        <BigNote t={t} className="tuner-a-note" />
        <span className="tuner-a-cents" role="status" data-in-tune={t.inTune}>{t.message}</span>
      </div>

      <div className="tuner-a-strings" role="group" aria-label="Strings">
        {[...STRINGS_DOWN].reverse().map(s => {
          const { name, octave } = noteParts(TUNING[s]);
          return (
            <button
              key={s} type="button" className="peg"
              data-heard={t.string === s} data-in-tune={t.string === s && t.inTune}
              aria-label={`Play ${pitchLabel(TUNING[s])}`} onClick={() => t.play(s)}
            >
              <span>{name}<sub>{octave}</sub></span>
            </button>
          );
        })}
      </div>
      <p className="text-muted m-0 text-center text-[12px]">Press a string to hear it</p>
    </section>
  );
}

/* ── B · On the neck ───────────────────────────────────────────────────── */

const ROW = 38;
const STRIPE = 22;
/** String gauges in px, high e first. */
const GAUGE = [1.2, 1.5, 1.9, 2.4, 2.9, 3.4];
const FRETS = [16, 31, 45, 58, 70, 81, 91];
const INLAYS = [38, 64, 86];

/** Moves a strobe pattern each frame by how far off `cents` is. */
function useStrobe(cents: number | null) {
  const pattern = useRef<SVGPatternElement>(null);
  const latest = useRef(cents);
  useEffect(() => {
    latest.current = cents;
  });
  useEffect(() => {
    let offset = 0;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      frame = requestAnimationFrame(tick);
      const c = latest.current;
      if (c != null) offset = (offset + strobeStep(c, now - last)) % STRIPE;
      last = now;
      pattern.current?.setAttribute('patternTransform', `translate(${offset} 0)`);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return pattern;
}

function NeckMock({ t }: { t: Tuner }) {
  const pattern = useStrobe(t.cents);
  const patternId = `neck${useId().replace(/[^\w-]/g, '')}`;
  const height = ROW * 6;
  return (
    <section className="card tuner-b" aria-label="Tuner">
      <header className="tuner-b-head">
        <div>
          <h1 className="m-0">Tuner</h1>
          <p className="text-muted m-0 text-[13px]">Standard tuning · A440</p>
        </div>
        <SoundSelect t={t} />
      </header>

      <div className="tuner-b-readout">
        <BigNote t={t} className="tuner-b-note" />
        <div className="tuner-b-side">
          <span className="tuner-b-cents" role="status" data-in-tune={t.inTune}>{t.message}</span>
          <span className="text-muted text-[12px]">
            Stripes drift while it’s out, and stand still in tune
          </span>
        </div>
      </div>

      <div className="tuner-b-neck" style={{ '--row': `${ROW}px` } as CSSProperties}>
        <div className="tuner-b-strings" role="group" aria-label="Strings">
          {STRINGS_DOWN.map(s => {
            const { name, octave } = noteParts(TUNING[s]);
            return (
              <button
                key={s} type="button" className="neck-key"
                data-heard={t.string === s} data-in-tune={t.string === s && t.inTune}
                aria-label={`Play ${pitchLabel(TUNING[s])}`} onClick={() => t.play(s)}
              >
                <span>{name}<sub>{octave}</sub></span>
              </button>
            );
          })}
        </div>
        <svg className="neck-board" width="100%" height={height} aria-hidden="true">
          <defs>
            <pattern
              ref={pattern} id={patternId} width={STRIPE} height={ROW}
              patternUnits="userSpaceOnUse"
            >
              <rect className="neck-stripe" width={STRIPE / 2} height={ROW} />
            </pattern>
          </defs>
          <rect className="neck-wood" width="100%" height={height} rx="10" />
          {FRETS.map(f => (
            <line key={f} className="neck-fret" x1={`${f}%`} x2={`${f}%`} y1="0" y2={height} />
          ))}
          {INLAYS.map(f => (
            <circle key={f} className="neck-inlay" cx={`${f}%`} cy={height / 2} r="6" />
          ))}
          <rect className="neck-nut" x="0" width="10" height={height} rx="3" />
          {STRINGS_DOWN.map((s, i) => {
            const y = ROW * i + ROW / 2;
            const heard = t.string === s;
            return (
              <g key={s} data-heard={heard} data-in-tune={heard && t.inTune} className="neck-row">
                {heard && (
                  <rect
                    className="neck-strobe" x="12" y={y - 13} width="100%" height="26"
                    fill={`url(#${patternId})`}
                  />
                )}
                <line
                  className="neck-string" x1="10" x2="100%" y1={y} y2={y}
                  strokeWidth={GAUGE[i]}
                />
              </g>
            );
          })}
        </svg>
      </div>
      <p className="text-muted m-0 text-[12px]">Press a string’s name to hear it</p>
    </section>
  );
}

/* ── C · Minimal ───────────────────────────────────────────────────────── */

function MinimalMock({ t }: { t: Tuner }) {
  const pos = t.cents == null ? 0 : clampCents(t.cents) / MAX_CENTS;
  return (
    <section className="tuner-c" aria-label="Tuner" data-in-tune={t.inTune}>
      <header className="grid justify-items-center gap-1">
        <h1 className="tuner-c-title">Tuner</h1>
        <span className="text-muted text-[13px]">Standard tuning · A440</span>
      </header>

      <BigNote t={t} className="tuner-c-note" />

      <div className="tuner-c-scale" aria-hidden="true">
        <span className="tuner-c-end">♭</span>
        <div className="tuner-c-track">
          <span className="tuner-c-zone" />
          {TICKS.filter(c => c % 10 === 0).map(c => (
            <span
              key={c} className="tuner-c-tick" data-major={c % 50 === 0}
              style={{ left: `${50 + c}%` }}
            />
          ))}
          <span
            className="tuner-c-marker" data-idle={t.cents == null}
            style={{ left: `${50 + pos * 50}%` }}
          />
        </div>
        <span className="tuner-c-end">♯</span>
      </div>
      <span className="tuner-c-cents" role="status">{t.message}</span>

      <div className="tuner-c-strings" role="group" aria-label="Strings">
        {[...STRINGS_DOWN].reverse().map(s => {
          const { name, octave } = noteParts(TUNING[s]);
          return (
            <button
              key={s} type="button" className="tuner-c-string"
              data-heard={t.string === s}
              aria-label={`Play ${pitchLabel(TUNING[s])}`} onClick={() => t.play(s)}
            >
              <span>{name}<sub>{octave}</sub></span>
            </button>
          );
        })}
      </div>
      <div className="tuner-c-sound">
        <span className="text-muted text-[12px]" aria-hidden="true">Strings play</span>
        <SoundSelect t={t} className="tuner-c-select" />
      </div>
    </section>
  );
}
