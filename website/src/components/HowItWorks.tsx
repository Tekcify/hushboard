"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { DurationArt, MenuBarArt, UnlockArt, WipeArt } from "./HowIllustrations";

type Step = { title: string; body: string; note: string; art: ReactNode };

const steps: Step[] = [
  {
    title: "Click the icon",
    body: "Hushboard sits in the menu bar on macOS, the system tray on Windows and the panel on Linux. Click it and press Lock keyboard.",
    note: "Right-click the icon for a quick lock",
    art: <MenuBarArt />,
  },
  {
    title: "Pick how long",
    body: "Lock for 30 seconds, a few minutes, or until you unlock it yourself. A 3-second countdown runs first, so you can still cancel.",
    note: "A timed lock never runs past 10 minutes",
    art: <DurationArt />,
  },
  {
    title: "Wipe every key",
    body: "Every key press is ignored while you clean. Hushboard counts them on screen, so you can see the lock is holding.",
    note: "Your mouse and trackpad keep working",
    art: <WipeArt />,
  },
  {
    title: "Unlock and carry on",
    body: "Hold the on-screen button for a second and a half, press Ctrl + Alt + U, or let the timer run out. Your keyboard is back straight away.",
    note: "The way out is always on screen",
    art: <UnlockArt />,
  },
];

// Space between the top of the viewport and the first pinned card, and how far
// each later card sits below the one before it, so the older ones peek out as a stack.
const PIN_TOP = 112;
const PEEK = 14;

export function HowItWorks() {
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const els = cards.current.filter(Boolean) as HTMLElement[];
      // How far each card has been covered by the one after it, from 0 to 1.
      const covered = els.map((el, i) => {
        const next = els[i + 1];
        if (!next) return 0;
        const pinAt = PIN_TOP + (i + 1) * PEEK;
        const distance = next.getBoundingClientRect().top - pinAt;
        return Math.min(Math.max(1 - distance / el.offsetHeight, 0), 1);
      });

      let current = 0;
      els.forEach((el, i) => {
        // A card sinks a little for every card that has landed on top of it.
        const depth = covered.slice(i).reduce((sum, c) => sum + c, 0);
        const flap = covered[i];
        const inner = el.firstElementChild as HTMLElement;
        inner.style.transform = `scale(${1 - depth * 0.045}) rotateX(${flap * 9}deg)`;
        inner.style.filter = `brightness(${1 - Math.min(depth, 2.5) * 0.22})`;
        if (i > 0 && covered[i - 1] > 0.35) current = i;
      });
      setActive(current);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[300px_1fr] lg:gap-14">
        <div className="lg:sticky lg:self-start" style={{ top: PIN_TOP }}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-seal">How it works</p>
          <h2 id="how-title" className="mt-4 text-[clamp(2rem,4.6vw,3.2rem)] font-semibold leading-[1.05] tracking-[-0.045em]">
            Lock, wipe, carry on
          </h2>
          <p className="mt-4 max-w-sm text-ink-muted">Four steps, and the whole thing takes about a minute.</p>

          <ol className="mt-10 hidden flex-col gap-1 lg:flex">
            {steps.map((s, i) => (
              <li key={s.title}>
                <a
                  href={`#how-step-${i + 1}`}
                  className={`group flex items-center gap-4 rounded-xl px-3 py-2.5 transition-colors ${
                    i === active ? "bg-surface-raised text-ink" : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <span
                    className={`grid size-7 place-items-center rounded-full border font-mono text-[11px] transition-colors ${
                      i === active ? "border-seal bg-seal text-on-seal" : i < active ? "border-seal/50 text-seal" : "border-line-strong"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{s.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <ol className="flex flex-col gap-8 pb-8 [perspective:1600px]">
          {steps.map((s, i) => (
            <li
              key={s.title}
              id={`how-step-${i + 1}`}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className="sticky scroll-mt-28"
              style={{ top: PIN_TOP + i * PEEK }}
            >
              <article className="relative origin-top overflow-hidden rounded-[28px] border border-line bg-[linear-gradient(180deg,#241e19,var(--surface-raised)_40%)] shadow-[0_-12px_40px_#0d0b0999,inset_0_1px_#ffffff0f] will-change-transform">
                <div className="relative grid gap-8 p-6 sm:p-9 md:grid-cols-[1fr_1.15fr] md:items-stretch">
                  <div className="flex flex-col">
                    <span className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-seal">
                      <span className="h-px w-6 bg-seal/60" />
                      Step {i + 1} of {steps.length}
                    </span>
                    <h3 className="mt-5 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-tight tracking-[-0.035em]">{s.title}</h3>
                    <p className="mt-4 leading-relaxed text-ink-muted">{s.body}</p>
                    <p className="mt-auto flex items-center gap-2 pt-8 text-sm text-ink">
                      <span className="size-1.5 rounded-full bg-seal" />
                      {s.note}
                    </p>
                  </div>
                  <div className="min-h-72">{s.art}</div>
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
