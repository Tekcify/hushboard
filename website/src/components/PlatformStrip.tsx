import { brewCommand } from "@/content/site";
import { CopyCommand } from "./CopyCommand";

const items = [
  { name: "macOS", note: "Menu bar and notch" },
  { name: "Windows", note: "System tray" },
  { name: "Linux", note: "X11 and Wayland" },
  { name: "MIT", note: "Open source license" },
];

// Where a partner-logo row would sit: the systems Hushboard runs on, and a one-line install.
export function PlatformStrip() {
  return (
    <section aria-label="Platforms" className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
      <p className="text-center text-sm text-ink-muted">Runs where you work</p>
      <ul className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
        {items.map((item) => (
          <li key={item.name} className="flex flex-col items-center gap-1 bg-surface px-4 py-6 text-center">
            <span className="text-xl font-semibold tracking-tight">{item.name}</span>
            <span className="text-xs text-ink-muted">{item.note}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex justify-center">
        <CopyCommand command={brewCommand} />
      </div>
    </section>
  );
}
