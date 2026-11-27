import type { ReactNode } from "react";
import { KeyStrip, TimePicker, WaysOut } from "./HowIllustrations";

const steps: { label: string; title: string; body: string[]; art: ReactNode }[] = [
  {
    label: "Step 1",
    title: "Pick how long",
    body: [
      "Lock for 30 seconds, a few minutes, or until you unlock it yourself.",
      "A 3-second countdown gives you time to change your mind.",
    ],
    art: <TimePicker />,
  },
  {
    label: "Step 2",
    title: "Wipe every key",
    body: [
      "Hushboard ignores every key press while you clean. The keys you hit show up on screen, so you can see the lock is holding.",
      "Your mouse and trackpad keep working the whole time.",
    ],
    art: <KeyStrip />,
  },
  {
    label: "Step 3",
    title: "Get back to work",
    body: [
      "Hold the on-screen button for a second and a half, press Ctrl + Alt + U, or wait for the timer.",
      "A timed lock never runs past 10 minutes.",
    ],
    art: <WaysOut />,
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <h2 id="how-title" className="text-center text-[clamp(2rem,4.6vw,3.4rem)] font-semibold tracking-[-0.045em]">
        Lock, wipe, carry on
      </h2>
      <div className="mt-12 flex flex-col gap-5">
        {steps.map((s) => (
          <article
            key={s.title}
            className="grid items-center gap-10 overflow-hidden rounded-[28px] border border-line bg-surface-raised p-7 sm:p-12 md:grid-cols-2"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-seal">{s.label}</p>
              <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold tracking-[-0.035em]">{s.title}</h3>
              {s.body.map((p) => (
                <p key={p} className="mt-4 max-w-md leading-relaxed text-ink-muted">
                  {p}
                </p>
              ))}
            </div>
            <div className="dot-grid flex min-h-72 items-center justify-center rounded-3xl border border-line/70 bg-surface p-6">
              {s.art}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
