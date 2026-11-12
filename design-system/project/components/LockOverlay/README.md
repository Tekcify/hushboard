# LockOverlay

The full-screen view shown while the keyboard is locked; it composes StatusPill, Countdown, Keycap and HoldButton on a `suds` wash.

**Order, top to bottom (fixed):** StatusPill "Keyboard locked" → `title-lg` headline → one line of `body` in `ink-muted` saying what still works → Countdown (omit when duration is Never) → strip of up to 6 recent Keycaps (only if "Show keys I press while locked" is on) → HoldButton with its hint → escape shortcut line.

**Rules:**
- The overlay covers every display, on top of all windows, but it is NOT a security lock screen. No password; the pointer stays live.
- The way out is always on screen: HoldButton, the escape shortcut, and the timer when one is set.
- Optional dim: when "Dim the screen while locked" is on, lower brightness or draw the overlay at full opacity so smudges show up better on a dark screen. Never turn the display off; the user needs to see the exit.
- Fade in and out over `motion-slow`; no other motion.
- On unlock, show a 2 s toast "Keyboard unlocked" in the main window, then close the overlay.

**Headline copy:** "Wipe away" (default). Alternatives: "Keyboard locked", "Go ahead, clean". Never jokes about danger or data.
