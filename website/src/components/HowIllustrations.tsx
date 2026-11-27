"use client";

import { useEffect, useState } from "react";

function useTick(ms: number) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

const DURATIONS = ["30 s", "1 min", "2 min", "5 min", "Until I unlock"];

export function TimePicker() {
  const tick = useTick(1000);
  const active = Math.floor(tick / 4) % DURATIONS.length;
  const count = 3 - (tick % 4);
  return (
    <div aria-hidden className="flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex w-full flex-wrap justify-center gap-1 rounded-2xl bg-surface-sunken p-1.5">
        {DURATIONS.map((d, i) => (
          <span
            key={d}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-300 sm:text-sm ${
              i === active ? "bg-seal text-on-seal" : "text-ink-muted"
            }`}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="relative grid size-28 place-items-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
          <circle cx="50" cy="50" r="44" fill="none" stroke="var(--surface-sunken)" strokeWidth="6" />
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="var(--caution)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={276.5}
            strokeDashoffset={count > 0 ? 276.5 * (1 - count / 3) : 276.5}
            className="transition-[stroke-dashoffset] duration-700"
          />
        </svg>
        <span className="font-mono text-4xl font-semibold tabular-nums text-caution">{count > 0 ? count : "✓"}</span>
      </div>
      <span className="text-xs text-ink-muted">{count > 0 ? "Locking in…" : "Locked"}</span>
    </div>
  );
}

const WIPE = ["Q", "W", "E", "R", "A", "S", "D", "⌘", "space", "Z", "X", "C"];

export function KeyStrip() {
  const tick = useTick(450);
  const shown = WIPE.slice(0, (tick % (WIPE.length + 4)) + 1).slice(-6);
  const seconds = 59 - (Math.floor(tick / 2) % 60);
  return (
    <div aria-hidden className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl bg-surface-sunken px-6 py-10">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Keyboard locked</span>
      <span className="font-sans text-6xl font-extralight tabular-nums tracking-tight">
        1:{String(seconds).padStart(2, "0")}
      </span>
      <span className="h-px w-40 bg-line-strong/60" />
      <span className="flex h-8 items-center gap-3 font-mono text-lg text-on-suds">
        {shown.map((k, i) => (
          <span key={`${tick}-${i}`} style={{ opacity: 0.25 + (i / shown.length) * 0.75 }}>
            {k}
          </span>
        ))}
      </span>
    </div>
  );
}

export function WaysOut() {
  return (
    <ul aria-hidden className="flex w-full max-w-md flex-col gap-3">
      <li className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-sunken px-5 py-4">
        <span className="text-sm text-ink-muted">Hold the button</span>
        <span className="relative overflow-hidden rounded-xl border border-line-strong px-4 py-2 text-sm font-semibold">
          <span className="hold-fill absolute inset-0 origin-left bg-suds" />
          <span className="relative">Hold to unlock</span>
        </span>
      </li>
      <li className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-sunken px-5 py-4">
        <span className="text-sm text-ink-muted">Press the shortcut</span>
        <span className="flex gap-1.5">
          {["ctrl", "alt", "U"].map((k) => (
            <kbd key={k} className="grid h-9 min-w-9 place-items-center rounded-lg border border-[#3a3029] bg-key-face px-2 font-mono text-xs shadow-[0_2px_0_var(--key-edge)]">
              {k}
            </kbd>
          ))}
        </span>
      </li>
      <li className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface-sunken px-5 py-4">
        <span className="text-sm text-ink-muted">Let the timer finish</span>
        <span className="font-mono text-sm tabular-nums text-seal">0:00</span>
      </li>
    </ul>
  );
}
