import type { ReactNode } from "react";
import { brewCommand } from "@/content/site";
import { CopyCommand } from "./CopyCommand";
import { OsIcon } from "./OsIcon";
import { Reveal } from "./Reveal";

function LicenseIcon({ size }: { size: number }) {
  // A balance scale, the usual mark for a license.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3v18M7 21h10M5 7h14M12 5.5 5 7m7-1.5L19 7" />
      <path d="M5 7 2 14a3 3 0 0 0 6 0L5 7Zm14 0-3 7a3 3 0 0 0 6 0l-3-7Z" />
    </svg>
  );
}

const items: { name: string; note: string; icon: ReactNode }[] = [
  { name: "macOS", note: "Menu bar and notch", icon: <OsIcon platform="mac" size={26} /> },
  { name: "Windows", note: "System tray", icon: <OsIcon platform="windows" size={22} /> },
  { name: "Linux", note: "X11 and Wayland", icon: <OsIcon platform="linux" size={26} /> },
  { name: "MIT", note: "Open source license", icon: <LicenseIcon size={26} /> },
];

// Where a partner-logo row would sit: the systems Hushboard runs on, and a one-line install.
export function PlatformStrip() {
  return (
    <section aria-label="Platforms" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <Reveal as="p" variant="soft" className="text-center text-sm text-ink-muted">
        Runs where you work
      </Reveal>
      <Reveal
        as="ul"
        variant="scale"
        delay={120}
        className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4"
      >
        {items.map((item) => (
          <li key={item.name} className="group flex flex-col items-center gap-1 bg-surface px-4 py-7 text-center">
            <span className="mb-3 grid h-7 place-items-center text-ink-muted transition-colors group-hover:text-seal">{item.icon}</span>
            <span className="text-xl font-semibold tracking-tight">{item.name}</span>
            <span className="text-xs text-ink-muted">{item.note}</span>
          </li>
        ))}
      </Reveal>
      <Reveal variant="soft" delay={300} className="mt-6 flex justify-center">
        <CopyCommand command={brewCommand} />
      </Reveal>
    </section>
  );
}
