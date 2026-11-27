"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { links } from "@/content/site";

export function Header() {
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    const update = () => setDocked(window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3">
      <div
        className={`pointer-events-auto flex w-full items-center justify-between gap-4 rounded-full border px-3 py-2 transition-all duration-300 ${
          docked
            ? "max-w-3xl border-line bg-surface-raised/70 shadow-[0_10px_40px_#0d0b09b0] backdrop-blur-xl"
            : "max-w-6xl border-transparent"
        }`}
      >
        <a href="#top" className="flex items-center gap-2.5 pl-1 font-semibold tracking-tight">
          <Image src="/brand.svg" alt="" width={30} height={30} />
          <span className="text-[1.05rem]">Hushboard</span>
        </a>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-ink-muted sm:flex">
          <a className="transition-colors hover:text-ink" href="#how">How it works</a>
          <a className="transition-colors hover:text-ink" href="#faq">FAQ</a>
          <a className="transition-colors hover:text-ink" href={links.repo}>GitHub</a>
        </nav>
        <a
          href="#download"
          className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-seal-strong"
        >
          Download
        </a>
      </div>
    </header>
  );
}
