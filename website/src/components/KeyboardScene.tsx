"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

// [label, width]. Widths are relative within a row, like real keycaps.
const ROWS: [string, number][][] = [
  [["esc", 1.4], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1], ["6", 1], ["7", 1], ["8", 1], ["9", 1], ["0", 1], ["-", 1], ["=", 1], ["delete", 1.6]],
  [["tab", 1.5], ["Q", 1], ["W", 1], ["E", 1], ["R", 1], ["T", 1], ["Y", 1], ["U", 1], ["I", 1], ["O", 1], ["P", 1], ["[", 1], ["]", 1], ["\\", 1.5]],
  [["caps", 1.8], ["A", 1], ["S", 1], ["D", 1], ["F", 1], ["G", 1], ["H", 1], ["J", 1], ["K", 1], ["L", 1], [";", 1], ["'", 1], ["return", 2.2]],
  [["shift", 2.4], ["Z", 1], ["X", 1], ["C", 1], ["V", 1], ["B", 1], ["N", 1], ["M", 1], [",", 1], [".", 1], ["/", 1], ["shift", 2.6]],
  [["fn", 1], ["ctrl", 1], ["opt", 1], ["⌘", 1.3], ["space", 5.4], ["⌘", 1.3], ["opt", 1], ["◀", 1], ["▲", 1], ["▶", 1]],
];

// Horizontal centre of every key as a percentage of the row, for hit testing.
const KEYS = ROWS.flatMap((row, r) => {
  const total = row.reduce((sum, [, w]) => sum + w, 0);
  let x = 0;
  return row.map(([label, w], i) => {
    const centre = ((x + w / 2) / total) * 100;
    x += w;
    return { id: `${r}-${i}`, label, row: r, centre, half: (w / total) * 50 };
  });
});

type Phase = "idle" | "arming" | "locked" | "back";

// Timeline of one loop, in seconds.
const CYCLE = 15;
const CLICK = 2.2;
const LOCK = CLICK + 3;
const WIPE_START = LOCK + 0.5;
const WIPE_END = 11.6;
const UNLOCK = 12.3;
const LOCK_SECONDS = 30;

const ease = (u: number) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);
const clamp = (v: number) => Math.min(1, Math.max(0, v));

export function KeyboardScene() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [arm, setArm] = useState(3);
  const [timer, setTimer] = useState(LOCK_SECONDS);
  const [strip, setStrip] = useState<{ n: number; label: string }[]>([]);
  const [stopped, setStopped] = useState(0);

  const keyRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const clothRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lit = new Set<string>();
    let phaseNow: Phase | null = null;
    let count = 0;
    let raf = 0;
    const start = performance.now();

    const render = (t: number) => {
      const p: Phase = t < CLICK ? "idle" : t < LOCK ? "arming" : t < UNLOCK ? "locked" : "back";
      if (p !== phaseNow) {
        phaseNow = p;
        setPhase(p);
        if (p === "idle") {
          count = 0;
          setStopped(0);
          setStrip([]);
        }
      }
      if (p === "arming") setArm(3 - Math.floor(t - CLICK));
      if (p === "locked") {
        setTimer(Math.max(0, Math.ceil((LOCK_SECONDS * (UNLOCK - t)) / (UNLOCK - LOCK))));
      }

      // The pointer glides to the Lock button, clicks, then keeps moving to show it still works.
      const cursor = cursorRef.current;
      if (cursor) {
        let x: number;
        let y: number;
        if (t < CLICK) {
          const u = ease(clamp((t - 0.4) / (CLICK - 0.6)));
          x = 82 + (50 - 82) * u;
          y = 86 + (62 - 86) * u;
        } else if (t < UNLOCK) {
          const s = t - CLICK;
          x = 50 + 16 * Math.sin(s * 0.7) * clamp(s / 2);
          y = 62 - 10 * Math.sin(s * 0.45) * clamp(s / 2);
        } else {
          x = 50 + 16 * Math.sin((UNLOCK - CLICK) * 0.7);
          y = 62 - 10 * Math.sin((UNLOCK - CLICK) * 0.45);
        }
        const press = Math.abs(t - CLICK) < 0.12 ? 0.82 : 1;
        cursor.style.left = `${x}%`;
        cursor.style.top = `${y}%`;
        cursor.style.transform = `scale(${press})`;
      }

      // The cloth sweeps right to left and back while the keyboard is locked.
      const cloth = clothRef.current;
      const wiping = t > WIPE_START && t < WIPE_END;
      let cx = 130;
      let cy = 2;
      if (wiping) {
        const u = (t - WIPE_START) / (WIPE_END - WIPE_START);
        cx = 50 + 64 * Math.cos(u * Math.PI * 2);
        cy = 2.1 + 1.1 * Math.sin(u * Math.PI * 5);
      }
      if (cloth) {
        const fade = wiping ? clamp(Math.min(t - WIPE_START, WIPE_END - t) / 0.4) : 0;
        cloth.style.left = `${cx - 15}%`;
        cloth.style.top = `${(cy / 5) * 100 - 26}%`;
        cloth.style.opacity = String(fade);
        cloth.style.transform = `rotate(${-10 + 6 * Math.sin(t * 1.7)}deg)`;
      }

      const added: string[] = [];
      for (const key of KEYS) {
        const under =
          wiping &&
          Math.abs(key.centre - cx) < 14 + key.half * 0.4 &&
          Math.abs(key.row - cy) < 1.4;
        const el = keyRefs.current[key.id];
        if (under && !lit.has(key.id)) {
          lit.add(key.id);
          el?.classList.add("on");
          added.push(key.label);
        } else if (!under && lit.has(key.id)) {
          lit.delete(key.id);
          el?.classList.remove("on");
        }
      }
      if (added.length) {
        count += added.length;
        setStopped(count);
        setStrip((prev) =>
          [...prev, ...added.map((label, i) => ({ n: count - added.length + i, label }))].slice(-7),
        );
      }
    };

    if (reduced) {
      render(8.5);
      return;
    }
    const frame = (now: number) => {
      render(((now - start) / 1000) % CYCLE);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const button = { idle: "Lock keyboard", arming: "Cancel", locked: "Hold to unlock", back: "Lock keyboard" }[phase];

  return (
    <div className="relative z-10 mx-auto w-full max-w-5xl">
      <div aria-hidden className="absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[48px] bg-[radial-gradient(ellipse_at_50%_40%,#f08a5d2e,transparent_65%)] blur-2xl" />
      {/* Solid and above the hero grid, which skips anything marked data-cursor-grid-ignore. */}
      <figure
        data-cursor-grid-ignore
        className="relative overflow-hidden rounded-[28px] border border-line bg-surface-raised p-2 shadow-[0_40px_120px_#0d0b09] sm:p-3"
      >
        {/* The screen, with the island growing out of the notch. */}
        <div className="relative aspect-[16/5] overflow-hidden rounded-[20px] bg-[radial-gradient(ellipse_at_78%_120%,#a44f2e_0%,#5a2c1c_38%,transparent_70%),radial-gradient(ellipse_at_10%_-20%,#3b2a20,transparent_60%),#120f0d]">
          <div className="absolute inset-x-0 top-0 flex h-7 items-center justify-between px-4 text-[10px] text-ink/60">
            <span className="flex gap-3">
              <span>File</span>
              <span>Edit</span>
              <span>View</span>
            </span>
            <span className="flex items-center gap-3">
              <Image src="/brand.svg" alt="" width={13} height={13} />
              <span>Fri 9:41</span>
            </span>
          </div>
          <Island phase={phase} arm={arm} timer={timer} strip={strip} />

          <div className="absolute left-1/2 top-[62%] -translate-x-1/2 -translate-y-1/2">
            <div
              className={`relative overflow-hidden rounded-xl border px-4 py-2 text-[clamp(0.62rem,1.4vw,0.85rem)] font-semibold transition-colors duration-300 ${
                phase === "locked"
                  ? "border-line-strong bg-surface-raised text-ink"
                  : phase === "arming"
                    ? "border-line-strong bg-surface-raised text-ink"
                    : "border-seal-edge bg-seal text-on-seal shadow-[0_3px_0_var(--seal-edge)]"
              }`}
            >
              {phase === "locked" && (
                <span aria-hidden className="hold-fill absolute inset-0 origin-left bg-suds" />
              )}
              <span className="relative">{button}</span>
            </div>
          </div>

          <div ref={cursorRef} className="pointer-events-none absolute z-10 origin-top-left" style={{ left: "82%", top: "86%" }}>
            <svg width="18" height="22" viewBox="0 0 18 22" aria-hidden>
              <path d="M1 1v17l4.6-4.3 3 6.8 3-1.3-3-6.6H15L1 1Z" fill="#fff" stroke="#0d0b09" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* The keyboard deck. */}
        <div className="scene-deck relative mt-2 overflow-hidden rounded-[20px] bg-[linear-gradient(180deg,#2a221c,#1a1511)] px-[4%] pb-[3%] pt-[3%] sm:mt-3">
          <div className="scene-keys relative grid gap-[0.7cqw]">
            {ROWS.map((row, r) => (
              <div key={r} className="flex gap-[0.7cqw]">
                {row.map(([label, w], i) => (
                  <span
                    key={i}
                    ref={(el) => {
                      keyRefs.current[`${r}-${i}`] = el;
                    }}
                    className="keycap h-[5.4cqw]"
                    style={{ flex: w }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ))}
            <div ref={clothRef} className="cloth" style={{ opacity: 0 }} />
          </div>
          <div className="mx-auto mt-[2.4%] h-[3cqw] w-[34%] rounded-[1.2cqw] border border-[#3a3029] bg-[#ffffff06]" />
        </div>

        <figcaption className="flex items-center justify-between gap-4 px-3 pb-1 pt-3 text-xs text-ink-muted sm:text-sm">
          <span>
            {phase === "locked" || phase === "back" ? (
              <>
                <span className="font-mono text-seal tabular-nums">{stopped}</span> key presses stopped
              </>
            ) : (
              "Keyboard ready"
            )}
          </span>
          <span className="hidden sm:inline">The pointer keeps working the whole time.</span>
        </figcaption>
      </figure>
    </div>
  );
}

function Island({
  phase,
  arm,
  timer,
  strip,
}: {
  phase: Phase;
  arm: number;
  timer: number;
  strip: { n: number; label: string }[];
}) {
  const open = phase !== "idle";
  const time = `0:${String(timer).padStart(2, "0")}`;
  return (
    <div
      role="status"
      className={`absolute left-1/2 top-1.5 z-10 flex -translate-x-1/2 items-center gap-2 overflow-hidden rounded-full bg-black px-3 text-[clamp(0.58rem,1.3vw,0.8rem)] font-semibold whitespace-nowrap text-ink shadow-[0_6px_24px_#000a] transition-all duration-500 ${
        open ? "h-[clamp(26px,4.2vw,38px)] w-[min(80%,520px)] justify-between" : "h-[clamp(16px,2.4vw,22px)] w-[clamp(70px,11vw,112px)] justify-center"
      }`}
    >
      {phase === "arming" && (
        <>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-caution" />
            Locking in {arm}
          </span>
          <span className="text-ink-muted">Cancel</span>
        </>
      )}
      {phase === "locked" && (
        <>
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-seal shadow-[0_0_8px_var(--seal)]" />
            Locked
          </span>
          <span className="flex min-w-0 flex-1 justify-center gap-1.5 overflow-hidden font-mono text-on-suds">
            {strip.map((k) => (
              <span key={k.n} className="island-letter">
                {k.label}
              </span>
            ))}
          </span>
          <span className="font-mono tabular-nums text-seal-strong">{time}</span>
        </>
      )}
      {phase === "back" && (
        <span className="flex w-full items-center justify-center gap-2">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path d="M2 6.4 4.8 9 10 3" fill="none" stroke="var(--seal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Keyboard back
        </span>
      )}
    </div>
  );
}
