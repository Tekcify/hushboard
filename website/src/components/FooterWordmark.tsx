"use client";

import { useSyncExternalStore } from "react";
import HalftoneWordmarkFooter from "./ui/halftone-wordmark-footer";

const noop = () => () => {};
const FALLBACK = '"Onest", "Helvetica Neue", Arial, system-ui, sans-serif';

// "hushboard" set huge across the bottom of the page in halftone dots. They part around the
// pointer and warm to clay, and a click sends a ripple through the word.
export function FooterWordmark() {
  // The canvas needs the real font name. next/font gives Onest a generated one, so read it
  // from the page once it's in the browser.
  const font = useSyncExternalStore(noop, () => getComputedStyle(document.body).fontFamily || FALLBACK, () => FALLBACK);
  // Finer dots on narrow screens, where the word is small.
  const narrow = useSyncExternalStore(noop, () => window.innerWidth < 640, () => false);

  return (
    <HalftoneWordmarkFooter
      bare
      wordmark="hushboard"
      palette={{ background: "#15120f", ink: "#f1e9e0", warm: "#f08a5d" }}
      fontFamily={font}
      fontWeight={700}
      dotGap={narrow ? 3.5 : 6}
      radius={narrow ? 50 : 90}
      crop={0.18}
      grain={0.5}
      height="clamp(60px, 16.5vw, 250px)"
    />
  );
}
