# Countdown

A ring with a big monospace time that shows how long the lock has left, or the arming count before it starts.

**Markup:** `.hb-countdown[role=timer]` containing an SVG with a `.hb-countdown__track` and a `.hb-countdown__arc` circle (r = 100, circumference 628.3), then `.hb-countdown__center` with `__time` and `__sub`. Progress: set `stroke-dashoffset = 628.3 × (1 − remaining / total)`.

**Variants:**
- Default (220 px): the lock overlay. Arc in `seal`, time in the `timer` mono style.
- `hb-countdown--caution`: add it when remaining ≤ `caution-window` (10 s). Arc and time switch to `caution`, and the sub-line says "unlocking soon".
- `hb-countdown--sm` (120 px): the arming count ("3 · locking") inside the main window, arc in `caution`.

**Format:** `m:ss` from one minute up, `0:ss` under it, bare seconds for arming. Digits are tabular so the width never jumps.

**Accessibility:** update `aria-label` at most every 10 s (every second during the caution window) to avoid flooding screen readers.
