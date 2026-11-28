"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

type Variant = "rise" | "scale" | "soft";
type State = "static" | "hidden" | "in";

// Rises into place the first time it scrolls into view. The server renders it visible, so the
// page reads fine without JavaScript, and with reduced motion it never animates. `delay` is in
// milliseconds, for staggering items in a list.
export function Reveal({
  as: Tag = "div",
  variant = "rise",
  delay = 0,
  className,
  style,
  children,
  ...rest
}: {
  as?: ElementType;
  variant?: Variant;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  [attr: string]: unknown;
}) {
  const ref = useRef<HTMLElement>(null);
  const [state, setState] = useState<State>("static");

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        // Wait a frame so the hidden state paints before the transition starts.
        frame = requestAnimationFrame(() => setState("in"));
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    // Hide it first, then let the observer bring it in. Anything already on screen
    // animates in straight away.
    frame = requestAnimationFrame(() => {
      setState("hidden");
      observer.observe(el);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={variant}
      data-reveal-state={state}
      className={className}
      style={{ ...style, "--d": `${delay}ms` } as CSSProperties}
      {...rest}
    >
      {children}
    </Tag>
  );
}
