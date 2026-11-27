import { links } from "@/content/site";
import CursorGrid from "./CursorGrid/CursorGrid";
import { DownloadButtons } from "./DownloadButtons";
import { KeyboardScene } from "./KeyboardScene";
import { OsIcon } from "./OsIcon";

export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden pt-32 sm:pt-40">
      {/* Clay cells light up around the pointer; the grid itself listens on the window,
          so the copy and the scene on top don't block it. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <CursorGrid
          cellSize={60}
          color="#f08a5d"
          gridColor="#f1e9e0"
          highlight="area"
          gridStyle="lines"
          radius={140}
          holdTime={400}
          fadeDuration={800}
          fillOpacity={0.035}
          maxOpacity={0.4}
          gridOpacity={0.04}
          spotlight={0.3}
          edgeFade={0}
          clickPulse
        />
      </div>
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-surface" />
      <div className="relative mx-auto max-w-4xl px-5 text-center">
        <a
          href={links.repo}
          className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised/70 py-1 pl-1 pr-3 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          <span className="rounded-full bg-suds px-2 py-0.5 font-semibold text-on-suds">Free</span>
          Open source, for
          <span className="flex items-center gap-1.5 text-ink">
            <OsIcon platform="mac" size={13} />
            <OsIcon platform="windows" size={11} />
            <OsIcon platform="linux" size={13} />
          </span>
          <span className="sr-only">macOS, Windows and Linux</span>
        </a>
        <h1 className="text-[clamp(2.7rem,7.4vw,5.6rem)] font-semibold leading-[0.98] tracking-[-0.055em] text-balance">
          A little pause.
          <br />
          <span className="text-seal">A cleaner keyboard.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-[clamp(1rem,1.8vw,1.2rem)] leading-relaxed text-ink-muted text-pretty">
          Lock your keyboard while you wipe it down. Your mouse keeps working, and the way out is
          always on screen.
        </p>
        <div className="mt-9 flex justify-center">
          <DownloadButtons compact />
        </div>
      </div>
      <div className="relative mt-16 px-4 sm:mt-20 sm:px-6">
        <KeyboardScene />
      </div>
    </section>
  );
}
