"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BatteryGlyph, ControlCentreGlyph, DOCK, SearchGlyph, TrashIcon, WifiGlyph } from "./MacIcons";
import "./MacScene.css";
// A MacBook in the hero. The pointer opens Hushboard from the menu bar and locks the keyboard,
// the island grows out of the notch, a cloth wipes the keys, then the pointer holds to unlock.

// [label, width, kind]. Widths are relative within a row, like real keycaps.
type Key = [string, number, ("fn" | "small" | "touch" | "arrows")?];
const ROWS: Key[][] = [
  [["esc", 1.5, "fn"], ...Array.from({ length: 12 }, (_, i): Key => [`F${i + 1}`, 1, "fn"]), ["", 1, "touch"]],
  [["`", 1], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["delete", 1.5, "small"]],
  [["tab", 1.5, "small"], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1]],
  [["caps", 1.8, "small"], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["return", 1.7, "small"]],
  [["shift", 2.3, "small"], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["shift", 2.3, "small"]],
  [["fn", 1, "small"], ["⌃", 1], ["⌥", 1], ["⌘", 1.25], ["space", 5.2, "small"], ["⌘", 1.25], ["⌥", 1], ["◀", 1], ["▲▼", 1, "arrows"], ["▶", 1]],
];

// Row heights as a share of the keyboard, top to bottom: the function row is shorter.
const ROW_H = [0.55, 1, 1, 1, 1, 1];
const ROW_TOTAL = ROW_H.reduce((a, b) => a + b, 0);

// Every key's centre as a percentage of the keyboard, for hit testing the cloth.
const KEYS = ROWS.flatMap((row, r) => {
  const total = row.reduce((sum, [, w]) => sum + w, 0);
  const top = ROW_H.slice(0, r).reduce((a, b) => a + b, 0);
  const cy = ((top + ROW_H[r] / 2) / ROW_TOTAL) * 100;
  let x = 0;
  return row.map(([label, w, kind], i) => {
    const cx = ((x + w / 2) / total) * 100;
    x += w;
    const chip = kind === "touch" ? "" : kind === "arrows" ? "▼" : label === "space" ? "␣" : label;
    return { id: `${r}-${i}`, chip, cx, cy, half: (w / total) * 50 };
  });
});

type Phase = "idle" | "panel" | "arming" | "locked" | "holding" | "done";

// One loop, in seconds.
const CYCLE = 15;
const OPEN = 1.8; // pointer clicks the menu bar icon
const CLICK = 3.0; // pointer clicks Lock keyboard
const LOCK = CLICK + 3; // after the 3-second countdown
const WIPE_START = LOCK + 0.4;
const WIPE_END = 11.2;
const HOLD = 11.9; // pointer starts holding the button
const UNLOCK = HOLD + 1.5;
const HIDE = 14.5; // island tucks back into the notch
const LOCK_SECONDS = 60;
const RING = 2 * Math.PI * 44;

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const clamp = (v: number) => Math.min(1, Math.max(0, v));
const mix = (a: number, b: number, u: number) => a + (b - a) * u;

const phaseAt = (t: number): Phase =>
  t < OPEN ? "idle" : t < CLICK ? "panel" : t < LOCK ? "arming" : t < HOLD ? "locked" : t < UNLOCK ? "holding" : t < HIDE ? "done" : "idle";

export function KeyboardScene() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arm, setArm] = useState(3);
  const [left, setLeft] = useState(LOCK_SECONDS);
  const [chips, setChips] = useState<{ n: number; label: string }[]>([]);
  const [ignored, setIgnored] = useState(0);
  const [pressed, setPressed] = useState(false);

  const viewRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLSpanElement>(null);
  const lockRef = useRef<HTMLSpanElement>(null);
  const holdRef = useRef<HTMLSpanElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const clothRef = useRef<HTMLDivElement>(null);
  const keyRefs = useRef<Record<string, HTMLSpanElement | null>>({});

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lit = new Set<string>();
    let phaseNow: Phase | null = null;
    let pressedNow = false;
    let count = 0;
    let raf = 0;
    const start = performance.now();

    // Where an element sits inside the screen, as percentages.
    const spot = (el: HTMLElement | null, fx: number, fy: number, fallback: [number, number]): [number, number] => {
      const view = viewRef.current;
      if (!el || !view) return fallback;
      const v = view.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      if (!v.width || !r.width) return fallback;
      return [((r.left + r.width * fx - v.left) / v.width) * 100, ((r.top + r.height * fy - v.top) / v.height) * 100];
    };

    const render = (t: number) => {
      const p = phaseAt(t);
      if (p !== phaseNow) {
        phaseNow = p;
        setPhase(p);
        if (p === "panel") {
          count = 0;
          setIgnored(0);
          setChips([]);
        }
      }
      if (p === "arming") setArm(3 - Math.floor(t - CLICK));
      if (t >= LOCK && t < UNLOCK) setLeft(Math.max(0, Math.round(LOCK_SECONDS - (t - LOCK) * 5)));

      // The pointer: rest, menu bar icon, Lock button, wander while locked, then hold the button.
      const rest: [number, number] = [64, 68];
      const tray = spot(trayRef.current, 0.5, 0.6, [80, 3]);
      const lock = spot(lockRef.current, 0.5, 0.6, [80, 26]);
      const hold = spot(holdRef.current, 0.55, 0.62, [52, 20]);
      const wander: [number, number] = [56 + 14 * Math.sin((t - CLICK) * 0.6), 52 + 10 * Math.sin((t - CLICK) * 0.9)];
      let at: [number, number];
      if (t < OPEN) {
        const u = ease(clamp((t - 0.5) / (OPEN - 0.65)));
        at = [mix(rest[0], tray[0], u), mix(rest[1], tray[1], u)];
      } else if (t < CLICK) {
        const u = ease(clamp((t - OPEN - 0.2) / (CLICK - OPEN - 0.35)));
        at = [mix(tray[0], lock[0], u), mix(tray[1], lock[1], u)];
      } else if (t < HOLD - 1) {
        const u = ease(clamp((t - CLICK - 0.2) / 1.2));
        at = [mix(lock[0], wander[0], u), mix(lock[1], wander[1], u)];
      } else if (t < UNLOCK) {
        const from: [number, number] = [56 + 14 * Math.sin((HOLD - 1 - CLICK) * 0.6), 52 + 10 * Math.sin((HOLD - 1 - CLICK) * 0.9)];
        const u = ease(clamp((t - (HOLD - 1)) / 0.9));
        at = [mix(from[0], hold[0], u), mix(from[1], hold[1], u)];
      } else {
        const u = ease(clamp((t - UNLOCK - 0.3) / 1.2));
        at = [mix(hold[0], rest[0], u), mix(hold[1], rest[1], u)];
      }
      const down = Math.abs(t - OPEN) < 0.12 || Math.abs(t - CLICK) < 0.12 || (t >= HOLD && t < UNLOCK);
      if (down !== pressedNow) {
        pressedNow = down;
        setPressed(down);
      }
      const pointer = pointerRef.current;
      if (pointer) {
        pointer.style.left = `${at[0]}%`;
        pointer.style.top = `${at[1]}%`;
        pointer.style.transform = `scale(${down ? 0.85 : 1})`;
      }

      // The cloth sweeps right to left and back across the keys while they're locked.
      const wiping = t > WIPE_START && t < WIPE_END;
      let cx = 140;
      let cy = 50;
      // -1 when the hand is moving left at full speed, 1 when moving right.
      let lean = 0;
      if (wiping) {
        const u = (t - WIPE_START) / (WIPE_END - WIPE_START);
        cx = 50 + 48 * Math.cos(u * Math.PI * 2);
        cy = 56 + 18 * Math.sin(u * Math.PI * 5);
        lean = -Math.sin(u * Math.PI * 2);
      }
      const cloth = clothRef.current;
      if (cloth) {
        cloth.style.left = `${cx - 15}%`;
        cloth.style.top = `${cy - 36}%`;
        cloth.style.opacity = String(wiping ? clamp(Math.min(t - WIPE_START, WIPE_END - t) / 0.4) : 0);
        // The hand leans into the direction it's pushing, and the cloth drags a little behind it.
        cloth.style.transform = `rotate(${-6 + 4 * Math.sin(t * 1.7) + lean * 5}deg) skewX(${lean * -7}deg) scaleX(${1 - Math.abs(lean) * 0.04})`;
      }

      const added: string[] = [];
      for (const key of KEYS) {
        const under = wiping && Math.abs(key.cx - cx) < 11 + key.half * 0.4 && Math.abs(key.cy - cy) < 20;
        const el = keyRefs.current[key.id];
        if (under && !lit.has(key.id)) {
          lit.add(key.id);
          el?.classList.add("on");
          if (key.chip) added.push(key.chip);
        } else if (!under && lit.has(key.id)) {
          lit.delete(key.id);
          el?.classList.remove("on");
        }
      }
      if (added.length) {
        count += added.length;
        setIgnored(count);
        // The island shows the last four, like the app.
        setChips((prev) => [...prev, ...added.map((label, i) => ({ n: count - added.length + i, label }))].slice(-4));
      }
    };

    if (reduced) {
      // One still frame: locked, mid-wipe. Run the wipe up to that point so the chips fill in.
      for (let t = WIPE_START; t <= 8.6; t += 0.05) render(t);
      return;
    }
    const frame = (now: number) => {
      render(((now - start) / 1000) % CYCLE);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const locked = phase === "locked" || phase === "holding";
  const time = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;

  return (
    <div className="relative z-10 mx-auto w-full max-w-[56rem]">
      <div aria-hidden className="absolute -inset-x-16 -top-10 bottom-10 -z-10 bg-[radial-gradient(ellipse_at_50%_35%,#f08a5d2a,transparent_62%)] blur-2xl" />
      {/* Solid and above the hero grid, which skips anything marked data-cursor-grid-ignore. */}
      <figure data-cursor-grid-ignore className="mac" aria-label="Hushboard locking a MacBook keyboard while a cloth wipes the keys">
        <div className="mac-lid">
          <div className="mac-screen">
            <div ref={viewRef} className="mac-view">
              <div className="mac-menubar">
                <span className="left">
                  <b>Notes</b>
                  <span>File</span>
                  <span>Edit</span>
                  <span className="hidden sm:inline">Format</span>
                  <span className="hidden sm:inline">View</span>
                </span>
                <span className="right">
                  <span ref={trayRef} className="mac-tray" data-open={phase === "panel"}>
                    {locked || phase === "arming" ? <LockedTrayIcon /> : <Image src="/brand.svg" alt="" width={14} height={14} className="size-[calc(var(--u)*1.35)]" />}
                  </span>
                  <span className="battery">
                    <BatteryGlyph />
                  </span>
                  <WifiGlyph />
                  <SearchGlyph />
                  <ControlCentreGlyph />
                  <span>Fri 28 Nov&nbsp;&nbsp;9:41</span>
                </span>
              </div>

              <div className="mac-window">
                <header>
                  <i />
                  <i />
                  <i />
                </header>
                <div className="doc">
                  <h4>Friday</h4>
                  <p>Wipe the keyboard before the call</p>
                  <p>Send the slides to Ada</p>
                  <div className="line w-[80%]" />
                  <div className="line w-[64%]" />
                  <div className="line w-[72%]" />
                </div>
              </div>

              <div className="mac-dock">
                {DOCK.map((app) => (
                  <span key={app.name} className="app" data-running={app.running ?? false}>
                    {app.icon}
                  </span>
                ))}
                <span className="app" data-running>
                  <Image src="/brand.svg" alt="" width={64} height={64} />
                </span>
                <span className="sep" />
                <span className="app">
                  <TrashIcon />
                </span>
              </div>

              <div className="mac-panel" data-open={phase === "panel"}>
                <div className="row">
                  <b>Hushboard</b>
                  <span className="flex items-center gap-[calc(var(--u)*0.5)] text-ink-muted">
                    <span className="size-[calc(var(--u)*0.6)] rounded-full bg-line-strong" />
                    Ready
                  </span>
                </div>
                <div className="seg">
                  <span>30 s</span>
                  <span className="on">1 min</span>
                  <span>5 min</span>
                  <span>Until</span>
                </div>
                <span ref={lockRef} className="lock" data-pressed={phase === "panel" && pressed}>
                  Lock keyboard
                </span>
              </div>

              <Island phase={phase} arm={arm} time={time} left={left} chips={chips} ignored={ignored} holdRef={holdRef} />

              <div ref={pointerRef} className="mac-pointer" style={{ left: "64%", top: "68%" }}>
                <svg viewBox="0 0 16 22" width="100%" height="100%" aria-hidden>
                  <path d="M1.2 1.2v16.4l4.1-3.9 2.9 6.7 2.9-1.2-2.8-6.6h5.6L1.2 1.2Z" fill="#0b0b0b" stroke="#fff" strokeWidth="1.3" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="mac-hinge" />
        <div className="mac-base" aria-hidden>
          <div className="mac-deck">
            <div className="mac-top">
              <div className="mac-grille" />
              <div className="mac-keys">
                {ROWS.map((row, r) => (
                  <div key={r} className="mac-row">
                    {row.map(([label, w, kind], i) =>
                      kind === "arrows" ? (
                        <span key={i} className="flex flex-col justify-between" style={{ flex: w }}>
                          <span className="mkey half">▲</span>
                          <span
                            ref={(el) => {
                              keyRefs.current[`${r}-${i}`] = el;
                            }}
                            className="mkey half"
                          >
                            ▼
                          </span>
                        </span>
                      ) : (
                        <span
                          key={i}
                          ref={(el) => {
                            keyRefs.current[`${r}-${i}`] = el;
                          }}
                          className={`mkey ${kind ?? ""}`}
                          style={{ flex: w }}
                        >
                          {label}
                        </span>
                      ),
                    )}
                  </div>
                ))}
                <div ref={clothRef} className="wiper" style={{ opacity: 0 }}>
                  <Image src="/hand-cloth.webp" alt="" width={640} height={661} className="wiper-photo" draggable={false} />
                </div>
              </div>
              <div className="mac-grille" />
            </div>
            <div className="mac-trackpad" />
            <div className="lip" />
          </div>
        </div>
      </figure>
    </div>
  );
}

function Island({
  phase,
  arm,
  time,
  left,
  chips,
  ignored,
  holdRef,
}: {
  phase: Phase;
  arm: number;
  time: string;
  left: number;
  chips: { n: number; label: string }[];
  ignored: number;
  holdRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const state = phase === "panel" ? "idle" : phase;
  const locked = state === "locked" || state === "holding";
  return (
    <div role="status" className="mac-island" data-state={state}>
      <div className="pane bar" data-show={state === "arming"}>
        <span>
          <span className="text-caution">Locking in</span>
          <span key={arm} className="count island-letter inline-block">
            {arm}
          </span>
        </span>
        <span className="text-ink-muted">Cancel</span>
      </div>

      <div className="pane locked" data-show={locked}>
        <div className="dial">
          <svg viewBox="0 0 100 100" aria-hidden>
            <circle cx="50" cy="50" r="44" stroke="#201b17" />
            <circle className="arc" cx="50" cy="50" r="44" strokeDasharray={RING} strokeDashoffset={RING * (1 - left / LOCK_SECONDS)} />
          </svg>
          <span className="time">{time}</span>
        </div>
        <div>
          <div className="title">Keyboard locked</div>
          {chips.length ? (
            <div className="keys">
              {chips.map((c) => (
                <span key={c.n} className="chip island-letter">
                  {c.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="sub">Pointer still works</div>
          )}
        </div>
        <div className="actions">
          <span ref={holdRef} className="hold">
            <span className="fill" />
            <span className="relative">{state === "holding" ? "Keep holding…" : "Hold to unlock"}</span>
          </span>
          <span className="hint">or ⌃⌥U</span>
        </div>
      </div>

      <div className="pane bar" data-show={state === "done"}>
        <span>
          <svg width="1.2em" height="1.2em" viewBox="0 0 16 16" aria-hidden>
            <path d="M3 8.5l3 3 7-7" fill="none" stroke="var(--seal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Keyboard back
        </span>
        <span className="text-ink-muted">
          {ignored} {ignored === 1 ? "key" : "keys"} ignored
        </span>
      </div>

      <span className="cam" />
    </div>
  );
}

function LockedTrayIcon() {
  // The app's locked tray icon: a keyboard with a line through it.
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <g fill="none" stroke="var(--caution)" strokeLinecap="round" strokeWidth="1.9">
        <path strokeLinejoin="round" d="M6.999 12h1m3.5 0h.5m4 0h1m-10 5h10" />
        <path d="m1.999 2l20 20m-1.463-.908C19.43 22 17.786 22 14.5 22h-5c-3.288 0-4.932 0-6.038-.908a4 4 0 0 1-.554-.554C2 19.431 2 17.788 2 14.5s0-4.931.908-6.038a4 4 0 0 1 .554-.554c.781-.641 1.83-.83 3.538-.885M21.976 17c.023-.71.023-1.534.023-2.5c0-3.287 0-4.931-.908-6.038a4 4 0 0 0-.555-.554C19.43 7 17.786 7 14.5 7H12" />
        <path strokeLinejoin="round" d="M11.999 7V5a1 1 0 0 1 1-1a1 1 0 0 0 1-1V2" />
      </g>
    </svg>
  );
}
