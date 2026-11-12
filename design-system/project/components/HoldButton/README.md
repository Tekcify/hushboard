# HoldButton

The unlock control: a pill that fills with `seal` while the pointer is held and fires only after `hold-to-unlock` (1500 ms).

**Why it exists:** while the keyboard is locked, the pointer is the way out. A damp cloth brushing the trackpad sends clicks, so a single click must never unlock. Holding for 1.5 s is deliberate and hard to trigger by accident.

**Markup:** `<button class="hb-hold" type="button" aria-describedby="hint">` with an icon and a label span, then a `.hb-hold__hint` line under it. Drive progress by setting the CSS variable `--hb-progress` (0 to 1) on the button; set `data-holding="true"` while held and `data-done="true"` when it fires.

**Behaviour the consumer provides:**
- Start timing on `pointerdown` with pointer capture; cancel on `pointerup`, `pointercancel` and `pointerleave`. Releasing early snaps progress back to 0.
- Read the duration from the `--hold-to-unlock` token instead of hard-coding it.
- Keyboard activation does nothing while locked (the keyboard is blocked anyway). When unlocked, the same component can serve "Hold to lock" for a no-timer lock.

**Do:** keep the hint text visible under it at all times.
**Don't:** shrink it below 240 × 56 px. On the lock overlay it is the main target.
