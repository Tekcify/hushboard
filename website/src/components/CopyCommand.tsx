"use client";

import { useState } from "react";

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked; the command is still selectable.
    }
  }

  return (
    <div className="flex max-w-full items-center gap-3 rounded-xl border border-line bg-surface-sunken py-1.5 pl-4 pr-1.5 font-mono text-[0.78rem] sm:text-sm">
      <span className="select-none text-seal">$</span>
      <code className="truncate text-ink">{command}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-line px-2.5 py-1 font-sans text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
