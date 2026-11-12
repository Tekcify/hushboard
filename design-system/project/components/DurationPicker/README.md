# DurationPicker

A segmented radio group that sets when the lock ends on its own; the default is 2 min.

**Markup:** a `.hb-field` with a `.hb-field__label`, then `.hb-seg[role=radiogroup]` holding `button[role=radio]` items; the selected one has `aria-checked="true"`.

**Options:** 30 s · 1 min · 2 min · 5 min · Never. Keep that order (shortest first) and those labels. "Never" means the lock ends only through HoldButton or the escape shortcut. When "Never" is picked, show the caption "Unlock with the button on screen or Ctrl + Alt + U" under the group so the way out is always stated.

**Keyboard (when unlocked):** arrow keys move the selection, as in any radio group.

**Don't:** offer more than 5 segments, or durations over 10 minutes. Nobody cleans a keyboard for longer, and a long lock is what makes people afraid of tools like this.
