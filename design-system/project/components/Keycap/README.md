# Keycap

A drawn key that shows what the keyboard is doing; while locked, each key you wipe lights up as "swallowed" so you can see the lock is working.

**Markup:** `<span class="hb-key">Q</span>`. Width modifiers: `hb-key--wide` (Esc, Shift, Backspace, Return), `hb-key--space`.

| State | Class | Look |
| --- | --- | --- |
| Rest | `hb-key` | `key-face`, `key-edge` border, `key-rest` 2px travel edge |
| Pressed (unlocked, e.g. testing) | `hb-key--down` | moved down 2px, `key-down` shadow |
| Swallowed (pressed while locked) | `hb-key--swallowed` | pressed + `suds` face, `on-suds` legend, `seal` border |

Swallowed keys fade back to rest after about 600 ms. The lock overlay can show a short strip of the last 6 swallowed keys. Never a full log: this is reassurance, not a keylogger, and nothing is stored.

**Shortcut chips:** `<span class="hb-kbd"><kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>U</kbd></span>`. On macOS write the modifiers as ⌃ ⌥ ⌘ ⇧.

Legends use the `keycap` mono style.
