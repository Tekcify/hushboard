# StatusPill

A small pill that names the lock state in words, with a coloured dot; it appears in the window header and the tray menu.

**Markup:** `<span class="hb-pill hb-pill--locked">Keyboard locked</span>`.

| State | Class | Copy |
| --- | --- | --- |
| Unlocked | `hb-pill` | "Unlocked" |
| Arming | `hb-pill--arming` (`caution`) | "Locking in 3 s" (live count) |
| Locked | `hb-pill--locked` (`suds` / `on-suds`, `seal` dot) | "Keyboard locked" |
| Error | `hb-pill--error` (`danger`, square dot) | "Needs permission", "Couldn't lock" |

The words carry the meaning; colour only supports them. The error dot is square so it differs by shape too.

**Do:** use `aria-live="polite"` on the pill's container so screen readers hear state changes.
