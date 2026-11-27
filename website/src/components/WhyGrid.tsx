const reasons: { title: string; body: string; soon?: boolean }[] = [
  {
    title: "Your pointer stays free",
    body: "Only the keyboard locks. You can still click, scroll and move windows around.",
  },
  {
    title: "Nothing gets recorded",
    body: "Key names show on screen and stay in memory. Hushboard never saves or sends what you type.",
  },
  {
    title: "Lock one keyboard",
    body: "On macOS and Linux you can lock just the built-in keyboard and keep typing on an external one.",
  },
  {
    title: "Out of your way",
    body: "It lives in the menu bar or system tray. On a Mac, the lock status grows out of the notch.",
  },
  {
    title: "Tells you what's wrong",
    body: "If a permission is off or something blocks the lock, the panel says so and shows you the fix.",
  },
  {
    title: "Updates itself",
    body: "Install it once. New versions arrive on their own.",
  },
  {
    title: "Open source",
    body: "MIT licensed. Read the code, build it yourself, or send a fix.",
  },
  {
    title: "Locks when you start wiping",
    body: "On macOS, Hushboard can notice a cloth pressing lots of keys at once and lock by itself. Off by default.",
    soon: true,
  },
];

export function WhyGrid() {
  return (
    <section aria-labelledby="why-title" className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <h2 id="why-title" className="text-center text-[clamp(2rem,4.6vw,3.4rem)] font-semibold tracking-[-0.045em]">
        Why Hushboard
      </h2>
      <ul className="mt-12 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {reasons.map((r) => (
          <li key={r.title} className="bg-surface p-7 transition-colors hover:bg-surface-raised">
            <h3 className="flex flex-wrap items-center gap-2 font-semibold tracking-tight">
              {r.title}
              {r.soon && (
                <span className="rounded-full bg-suds px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-suds">
                  Coming soon
                </span>
              )}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{r.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
