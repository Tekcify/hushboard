"use client";

import { useSyncExternalStore } from "react";
import { downloads, links, type Platform } from "@/content/site";
import { OsIcon } from "./OsIcon";

const noop = () => () => {};

// Reads the visitor's system from the browser. Chromium browsers report it through
// userAgentData; the rest fall back to the user agent string. Phones and anything
// unknown get the macOS build.
function detect(): Platform {
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? "";
  const ua = `${hinted} ${navigator.userAgent}`;
  if (/Windows/i.test(ua)) return "windows";
  if (/Android|CrOS/i.test(ua)) return "mac";
  if (/Linux|X11/i.test(ua)) return "linux";
  return "mac";
}

type Variant = "full" | "compact" | "single";

// The visitor's own system gets the big button; the others sit beside it.
export function DownloadButtons({ variant = "full", compact = false }: { variant?: Variant; compact?: boolean }) {
  // The server renders the macOS button; the browser swaps in the visitor's system.
  const platform = useSyncExternalStore(noop, detect, () => "mac" as Platform);

  const others = (Object.keys(downloads) as Platform[]).filter((p) => p !== platform);

  if (variant === "single") {
    return <PrimaryButton platform={platform} />;
  }

  if (compact || variant === "compact") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PrimaryButton platform={platform} />
        <a
          href={links.repo}
          className="inline-flex h-12 items-center rounded-xl border border-line-strong px-5 text-sm font-semibold transition-colors hover:bg-surface-raised"
        >
          View on GitHub
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <PrimaryButton platform={platform} />
      <p className="text-sm text-ink-muted">
        Also for{" "}
        {others.map((p, i) => (
          <span key={p}>
            {i > 0 && " and "}
            <a
              className="inline-flex items-center gap-1.5 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-seal"
              href={downloads[p].href}
            >
              <OsIcon platform={p} size={13} className="text-ink-muted" />
              {downloads[p].label.replace(/^(Download for|Get it for) /, "")}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}

function PrimaryButton({ platform }: { platform: Platform }) {
  return (
    <a
      href={downloads[platform].href}
      className="inline-flex h-12 items-center gap-2 rounded-xl bg-seal px-5 text-sm font-semibold text-on-seal shadow-[0_3px_0_var(--seal-edge)] transition-[background,transform,box-shadow] hover:bg-seal-strong active:translate-y-[3px] active:shadow-none"
    >
      <OsIcon platform={platform} size={platform === "windows" ? 15 : 17} />
      {downloads[platform].label}
    </a>
  );
}
