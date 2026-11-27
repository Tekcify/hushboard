"use client";

import { useSyncExternalStore } from "react";
import { downloads, links, type Platform } from "@/content/site";

const noop = () => () => {};

function detect(): Platform {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return "mac";
}

// The visitor's own system gets the big button; the others sit beside it.
export function DownloadButtons({ compact = false }: { compact?: boolean }) {
  // The server renders the macOS button; the browser swaps in the visitor's system.
  const platform = useSyncExternalStore(noop, detect, () => "mac" as Platform);

  const others = (Object.keys(downloads) as Platform[]).filter((p) => p !== platform);

  if (compact) {
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
            <a className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-seal" href={downloads[p].href}>
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
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 2v8m0 0 3.2-3.2M8 10 4.8 6.8M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {downloads[platform].label}
    </a>
  );
}
