"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

// A counter that ticks while motion is allowed. With reduced motion it stays at `still`,
// so each illustration shows one clear frame.
function useTick(ms: number, still = 0) {
  const [tick, setTick] = useState(still);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return tick;
}

function Pointer({ pressed }: { pressed: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      className={`drop-shadow-[0_2px_4px_#0009] transition-transform duration-150 ${pressed ? "scale-90" : ""}`}
    >
      <path d="M5 3l14 7.5-6.2 1.6L10 18z" fill="#f1e9e0" stroke="#15120f" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Step 1: open it from the menu bar ---------- */

// 8 beats of 650ms: glide to the icon, click, panel opens, glide to Lock, click, hold.
export function MenuBarArt() {
  const beat = useTick(650, 6) % 8;
  const open = beat >= 2;
  const onButton = beat >= 4;
  const pressed = beat === 1 || beat === 5;
  const locked = beat >= 5;
  const pos = onButton
    ? { left: "calc(86% - min(34%, 125px))", top: "150px" }
    : beat >= 1
      ? { left: "calc(78% - 8px)", top: "10px" }
      : { left: "38%", top: "62%" };

  return (
    <div aria-hidden className="relative h-full min-h-64 w-full overflow-hidden rounded-2xl border border-line bg-surface-sunken">
      <div className="flex h-8 items-center justify-between border-b border-line bg-surface-raised/80 px-4 text-[11px] text-ink-muted">
        <span className="flex gap-4">
          <span className="font-semibold text-ink">Notes</span>
          <span>File</span>
          <span>Edit</span>
        </span>
        <span className="font-mono">9:41</span>
      </div>
      <span
        className={`absolute right-[22%] top-1.5 grid size-5 place-items-center rounded-md transition-colors ${open ? "bg-ink/15" : ""}`}
      >
        <Image src="/brand.svg" alt="" width={14} height={14} />
      </span>

      <div
        className={`absolute right-[14%] top-10 w-[min(68%,250px)] origin-top-right rounded-xl border border-line-strong/50 bg-surface-raised p-3 shadow-[0_18px_40px_#000a] transition-all duration-300 ${
          open ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">Hushboard</span>
          <span className={`flex items-center gap-1.5 text-[10px] ${locked ? "text-seal" : "text-ink-muted"}`}>
            <span className={`size-1.5 rounded-full ${locked ? "bg-seal" : "bg-line-strong"}`} />
            {locked ? "Locking…" : "Ready"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-surface-sunken p-1 text-center text-[10px] text-ink-muted">
          <span>30 s</span>
          <span className="rounded-md bg-surface-raised py-1 text-ink">1 min</span>
          <span>5 min</span>
        </div>
        <span
          className={`mt-3 block rounded-lg py-2 text-center text-xs font-semibold transition-all ${
            locked ? "translate-y-px bg-seal-strong text-on-seal" : "bg-seal text-on-seal shadow-[0_2px_0_var(--seal-edge)]"
          }`}
        >
          Lock keyboard
        </span>
      </div>

      <span className="absolute transition-all duration-500 ease-out" style={pos}>
        <Pointer pressed={pressed} />
      </span>
    </div>
  );
}

/* ---------- Step 2: pick how long ---------- */

const DURATIONS = ["30 s", "1 min", "2 min", "5 min", "Until I unlock"];

// 5 beats per duration: select it, then count 3, 2, 1, locked.
export function DurationArt() {
  const tick = useTick(900, 2);
  const active = Math.floor(tick / 5) % DURATIONS.length;
  const beat = tick % 5;
  const count = beat >= 1 && beat <= 3 ? 4 - beat : 0;
  const locked = beat === 4;

  return (
    <div aria-hidden className="flex h-full min-h-64 w-full flex-col items-center justify-center gap-8 rounded-2xl border border-line bg-surface-sunken p-5">
      <div className="flex w-full max-w-sm flex-wrap justify-center gap-1 rounded-2xl border border-line bg-surface p-1.5">
        {DURATIONS.map((d, i) => (
          <span
            key={d}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors duration-300 ${
              i === active ? "bg-seal text-on-seal" : "text-ink-muted"
            }`}
          >
            {d}
          </span>
        ))}
      </div>

      <div
        className={`flex h-11 items-center gap-3 rounded-full bg-black px-5 text-sm font-semibold transition-all duration-300 ${
          count || locked ? "opacity-100" : "opacity-40"
        }`}
      >
        {locked ? (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" className="text-seal">
              <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            <span>Locked for {DURATIONS[active] === "Until I unlock" ? "now" : DURATIONS[active]}</span>
          </>
        ) : (
          <>
            <span className="text-caution">Locking in</span>
            <span key={tick} className="island-letter inline-block w-3 font-mono tabular-nums text-caution">
              {count || 3}
            </span>
            <span className="ml-2 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-ink-muted">Cancel</span>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Step 3: wipe every key ---------- */

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ";"],
  ["Z", "X", "C", "V", "B", "N", "M", ",", ".", "/"],
];
const SWEEP = 3.2; // seconds the cloth takes to cross, one way. See .wipe-cloth in globals.css.

export function WipeArt() {
  const tick = useTick(140, 40);
  const stopped = 12 + (tick % 160);

  return (
    <div aria-hidden className="flex h-full min-h-64 w-full flex-col items-center justify-center gap-6 rounded-2xl border border-line bg-surface-sunken p-5">
      <div className="flex h-10 items-center gap-3 whitespace-nowrap rounded-full bg-black px-5 text-xs">
        <span className="font-semibold">Locked</span>
        <span className="h-3 w-px bg-white/20" />
        <span className="tabular-nums text-on-suds">{stopped} key presses stopped</span>
      </div>

      <div className="scene-deck relative w-full max-w-md overflow-hidden rounded-xl bg-key-edge/60 p-[2.5%]">
        <div className="grid gap-[1.2%]">
          {ROWS.map((row, r) => (
            <div key={r} className="grid grid-cols-10 gap-[1.2%]" style={{ paddingLeft: `${r * 2.5}%` }}>
              {row.map((k, c) => (
                <span
                  key={k}
                  className="keycap wipe-key aspect-square"
                  // The key lights as the cloth passes over its column, on the way out and on the way back.
                  style={{ animationDelay: `${((c + 0.5 + r * 0.25) / 10) * SWEEP - 0.25}s` }}
                >
                  {k}
                </span>
              ))}
            </div>
          ))}
        </div>
        <span className="cloth wipe-cloth top-[8%]" />
      </div>
    </div>
  );
}

/* ---------- Step 4: unlock and carry on ---------- */

// 8 beats of 400ms: hold the button for most of them, then the keyboard comes back.
export function UnlockArt() {
  const beat = useTick(400, 3) % 9;
  const holding = beat >= 1 && beat <= 4;
  const back = beat >= 5;
  const fill = back ? 100 : holding ? beat * 25 : 0;

  return (
    <div aria-hidden className="flex h-full min-h-64 w-full flex-col items-center justify-center gap-6 rounded-2xl border border-line bg-surface-sunken p-5">
      <div className={`flex h-11 items-center gap-3 rounded-full bg-black px-5 text-sm font-semibold transition-colors`}>
        {back ? (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" className="text-seal">
              <path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Keyboard back
          </>
        ) : (
          <>
            <span>Keyboard locked</span>
            <span className="font-mono text-xs tabular-nums text-ink-muted">0:4{9 - beat}</span>
          </>
        )}
      </div>

      <div className="relative">
        <span
          className={`relative block overflow-hidden rounded-xl border px-6 py-3 text-sm font-semibold transition-colors ${
            back ? "border-seal/60 text-seal" : "border-line-strong"
          }`}
        >
          <span
            className="absolute inset-y-0 left-0 bg-suds transition-[width] duration-[400ms] ease-linear"
            style={{ width: `${fill}%` }}
          />
          <span className="relative">{back ? "Unlocked" : "Hold to unlock"}</span>
        </span>
        <span
          className={`absolute left-1/2 top-1/2 transition-opacity duration-200 ${holding ? "opacity-100" : "opacity-0"}`}
        >
          <Pointer pressed={holding} />
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          or press
          {["ctrl", "alt", "U"].map((k) => (
            <kbd
              key={k}
              className="grid h-6 min-w-6 place-items-center rounded-md border border-[#3a3029] bg-key-face px-1.5 font-mono text-[10px] text-ink shadow-[0_2px_0_var(--key-edge)]"
            >
              {k}
            </kbd>
          ))}
        </span>
        <span>or let the timer run out</span>
      </div>
    </div>
  );
}
