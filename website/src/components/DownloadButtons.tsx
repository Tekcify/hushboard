"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { allDownloads, downloads, links, version, type Platform } from "@/content/site";
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

// A split button: the visitor's own system on the left, and a menu with every build on the right,
// so anyone can grab the download for another machine.
export function DownloadButtons() {
  // The server renders the macOS button; the browser swaps in the visitor's system.
  const platform = useSyncExternalStore(noop, detect, () => "mac" as Platform);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative inline-flex">
      <div className="inline-flex h-12 rounded-xl bg-seal text-sm font-semibold text-on-seal shadow-[0_3px_0_var(--seal-edge)]">
        <a
          href={downloads[platform].href}
          className="inline-flex items-center gap-2 rounded-l-xl pl-5 pr-4 transition-colors hover:bg-seal-strong active:translate-y-[3px]"
        >
          <OsIcon platform={platform} size={platform === "windows" ? 15 : 17} />
          {downloads[platform].label}
        </a>
        <button
          type="button"
          aria-haspopup="true"
          aria-expanded={open}
          aria-controls={menuId}
          aria-label="Downloads for other systems"
          onClick={() => setOpen((o) => !o)}
          className="grid w-11 place-items-center rounded-r-xl border-l border-on-seal/20 transition-colors hover:bg-seal-strong"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`}>
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div
        id={menuId}
        hidden={!open}
        className="absolute left-0 top-[calc(100%+10px)] z-30 w-[min(20rem,calc(100vw-2rem))] rounded-2xl sm:left-1/2 sm:-translate-x-1/2 border border-line bg-surface-raised p-1.5 text-left shadow-[0_24px_60px_#000c]"
      >
        <p className="px-3 pb-1.5 pt-2 text-xs font-medium text-ink-muted">All downloads · v{version}</p>
        <ul>
          {allDownloads.map((d) => (
            <li key={d.href}>
              <a
                href={d.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface text-ink">
                  <OsIcon platform={d.platform} size={d.platform === "windows" ? 13 : 15} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{d.name}</span>
                  <span className="block text-xs text-ink-muted">{d.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
        <a
          href={links.releases}
          className="mt-1 block rounded-xl border-t border-line px-3 py-2.5 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          See every release on GitHub
        </a>
      </div>
    </div>
  );
}
