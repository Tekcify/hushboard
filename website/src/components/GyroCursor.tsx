"use client";

import { useEffect, useRef } from "react";

// An arrow cursor that turns toward where it's moving and settles back to the usual
// pointer angle when it stops. Its tip is the real click point, so it never lags.
// Only mice and trackpads get it; touch screens and reduced motion keep the system cursor.

const REST = -125; // degrees: tip up and a little left, like a normal pointer
const TURN = 0.2; // how much of the remaining turn to make each frame
const SETTLE_AFTER = 450; // ms without movement before it turns back to REST
const MIN_SPEED = 1.5; // px per event; slower moves don't change the heading

const INTERACTIVE = "a, button, [role=button], label, summary, select";

export function GyroCursor() {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || calm.matches || !el.current) return;

    const node = el.current;
    const root = document.documentElement;
    root.classList.add("gyro-cursor");

    let x = -100;
    let y = -100;
    let angle = REST;
    let target = REST;
    let lastMove = 0;
    let scale = 1;
    let pressed = false;
    let hovering = false;
    let frame = 0;

    const draw = () => {
      frame = 0;
      if (performance.now() - lastMove > SETTLE_AFTER) target = REST;
      // Turn the short way round.
      const diff = ((target - angle + 540) % 360) - 180;
      angle += diff * TURN;
      const wanted = pressed ? 0.85 : hovering ? 1.18 : 1;
      scale += (wanted - scale) * 0.3;
      node.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${angle}deg) scale(${scale})`;
      if (Math.abs(diff) > 0.1 || Math.abs(wanted - scale) > 0.001 || performance.now() - lastMove <= SETTLE_AFTER + 600) {
        frame = requestAnimationFrame(draw);
      }
    };
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const dx = e.clientX - x;
      const dy = e.clientY - y;
      const first = x === -100 && y === -100;
      x = e.clientX;
      y = e.clientY;
      if (!first && Math.hypot(dx, dy) > MIN_SPEED) {
        target = (Math.atan2(dy, dx) * 180) / Math.PI;
        lastMove = performance.now();
      }
      const over = e.target instanceof Element && e.target.closest(INTERACTIVE);
      hovering = Boolean(over);
      node.dataset.hover = hovering ? "true" : "false";
      node.style.opacity = "1";
      wake();
    };
    const onDown = () => {
      pressed = true;
      wake();
    };
    const onUp = () => {
      pressed = false;
      wake();
    };
    const onLeave = () => {
      node.style.opacity = "0";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);

    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("gyro-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, []);

  return (
    <div
      ref={el}
      aria-hidden
      data-hover="false"
      className="gyro-arrow pointer-events-none fixed left-0 top-0 z-[1000] opacity-0 transition-opacity duration-200"
      style={{ transformOrigin: "0 0", transform: `translate3d(-100px, -100px, 0) rotate(${REST}deg)` }}
    >
      {/* Drawn pointing right, with the tip at the element's origin. */}
      <svg width="30" height="26" viewBox="-27 -13 30 26" className="absolute -left-[27px] -top-[13px] overflow-visible drop-shadow-[0_3px_6px_#0008]">
        <path
          d="M0 0 L-22 -10.5 Q-24.5 -11.5 -23.6 -9 L-18.5 0 L-23.6 9 Q-24.5 11.5 -22 10.5 Z"
          fill="currentColor"
          stroke="#fff6ee"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
