import { DownloadButtons } from "./DownloadButtons";
import { OsIcon } from "./OsIcon";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section id="download" aria-labelledby="download-title" className="px-5 py-20 text-center sm:py-28">
      <Reveal
        as="h2"
        id="download-title"
        className="mx-auto max-w-2xl text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.045em]"
      >
        Ready for a cleaner keyboard?
      </Reveal>
      <Reveal as="p" delay={100} className="mx-auto mt-4 max-w-xl text-ink-muted">
        Lock the keys, wipe them down and get back to work in about a minute. Your mouse keeps working the whole time.
      </Reveal>
      <Reveal delay={200} className="relative z-20 mt-8 flex justify-center">
        <DownloadButtons />
      </Reveal>
      <Reveal
        as="p"
        variant="soft"
        delay={300}
        className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted"
      >
        Free and open source for
        <span className="flex items-center gap-1.5 text-ink">
          <OsIcon platform="mac" size={12} />
          <OsIcon platform="windows" size={10} />
          <OsIcon platform="linux" size={12} />
        </span>
        <span className="sr-only">macOS, Windows and Linux</span>
      </Reveal>
    </section>
  );
}
