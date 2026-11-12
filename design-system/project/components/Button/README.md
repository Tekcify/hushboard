# Button

A standard action button in four variants; use `hb-btn--primary` once per view for the main action.

**Markup:** `<button class="hb-btn hb-btn--primary" type="button">Lock keyboard</button>`. Add `hb-btn--lg` for the single hero action on the main window. An icon goes first as an inline 18px SVG with `stroke="currentColor"`.

| Variant | Use | Fill / text |
| --- | --- | --- |
| `--primary` | Lock keyboard, Start cleaning, Grant access | `seal` / `on-seal`, hover `seal-strong` |
| `--secondary` | Cancel, Open System Settings | `surface-raised` / `ink`, border `line-strong` |
| `--danger` | Force unlock, only after a failed or stuck lock | `danger` / `on-danger` |
| `--ghost` | Settings, Quit, low-priority links | transparent / `ink-muted` |

**States:** hover darkens, `:active` nudges down 1px, `:focus-visible` draws the 2px `focus-ring`, `disabled` turns `surface-sunken` with `ink-muted` text.

**Do:** label with a verb and the object ("Lock keyboard", not "Go").
**Don't:** use a plain Button to *unlock* the keyboard. Unlocking always uses HoldButton, so a cloth on the trackpad can't end the lock by accident.
