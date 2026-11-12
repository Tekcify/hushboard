// Hold-to-unlock: fills while the pointer is held and fires after the `hold-to-unlock` token
// (1.5 s), so a cloth brushing the trackpad can't end a lock. Shared by the island and the
// full-screen view.
import { timingMs } from "./tokens";

const HOLD_MS = timingMs("hold-to-unlock");

/** Wire a `.hb-hold` button. `label` (optional) reads "Unlocking" once it fires. */
export function wireHold(button: HTMLButtonElement, onDone: () => void, label?: HTMLElement): void {
  let start = 0;
  let raf = 0;

  const reset = () => {
    cancelAnimationFrame(raf);
    button.dataset.holding = "false";
    button.style.setProperty("--hb-progress", "0");
  };

  const tick = (t: number) => {
    const p = Math.min(1, (t - start) / HOLD_MS);
    button.style.setProperty("--hb-progress", String(p));
    if (p < 1) {
      raf = requestAnimationFrame(tick);
      return;
    }
    button.dataset.done = "true";
    if (label) label.textContent = "Unlocking";
    onDone();
  };

  button.addEventListener("pointerdown", (e) => {
    if (button.dataset.done === "true") return;
    button.setPointerCapture(e.pointerId);
    button.dataset.holding = "true";
    start = performance.now();
    raf = requestAnimationFrame(tick);
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(ev, () => {
      if (button.dataset.done !== "true") reset();
    });
  }
}
