import Image from "next/image";
import { brewCommand, links } from "@/content/site";
import { CopyCommand } from "./CopyCommand";
import { DownloadButtons } from "./DownloadButtons";

export function FinalCta() {
  return (
    <section id="download" aria-labelledby="download-title" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="dot-grid relative mx-auto max-w-6xl overflow-hidden rounded-[36px] border border-line bg-surface-raised px-6 py-16 text-center sm:py-24">
        <div aria-hidden className="absolute inset-x-0 -bottom-40 mx-auto h-80 max-w-3xl rounded-full bg-seal/25 blur-3xl" />
        <div className="relative">
          <Image src="/brand.svg" alt="" width={64} height={64} className="mx-auto" />
          <h2 id="download-title" className="mt-7 text-[clamp(2.2rem,5.4vw,4.2rem)] font-semibold leading-none tracking-[-0.05em]">
            Give your keyboard a wipe
          </h2>
          <p className="mx-auto mt-5 max-w-md text-ink-muted">
            Free for macOS, Windows and Linux. It takes a minute to install.
          </p>
          <div className="mt-9">
            <DownloadButtons />
          </div>
          <div className="mt-8 flex flex-col items-center gap-3">
            <span className="text-xs text-ink-muted">Or with Homebrew on a Mac</span>
            <CopyCommand command={brewCommand} />
            <a className="mt-2 text-sm text-ink-muted underline decoration-line-strong underline-offset-4 hover:text-ink" href={links.installGuide}>
              Installation guide
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
