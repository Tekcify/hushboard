import { DownloadButtons } from "./DownloadButtons";
import { OsIcon } from "./OsIcon";

export function FinalCta() {
  return (
    <section id="download" aria-labelledby="download-title" className="px-5 py-20 text-center sm:py-28">
      <h2
        id="download-title"
        className="mx-auto max-w-2xl text-[clamp(2rem,4.6vw,3.4rem)] font-semibold leading-[1.1] tracking-[-0.045em]"
      >
        Ready for a cleaner keyboard?
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-ink-muted">
        Lock the keys, wipe them down and get back to work in about a minute. Your mouse keeps working the whole time.
      </p>
      <div className="mt-8">
        <DownloadButtons variant="single" />
      </div>
      <p className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-md border border-line px-2.5 py-1 text-xs text-ink-muted">
        Free and open source for
        <span className="flex items-center gap-1.5 text-ink">
          <OsIcon platform="mac" size={12} />
          <OsIcon platform="windows" size={10} />
          <OsIcon platform="linux" size={12} />
        </span>
        <span className="sr-only">macOS, Windows and Linux</span>
      </p>
    </section>
  );
}
