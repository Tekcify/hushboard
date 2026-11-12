Hushboard is a small desktop app for macOS, Windows and Linux that locks the keyboard so you can wipe it down. The pointer keeps working, and the way out is always on screen. Every screen exists to answer three questions: is it locked, when does it end, and how do I get out now.

## Content fundamentals

- Voice: calm, plain, brief. A helpful tool, not a security product. Second person ("Your mouse still works"), no "we".
- Sentence case everywhere: buttons, titles, menu items. Uppercase only for `eyebrow` section labels.
- Say exactly what is blocked and what still works. "Key presses are being ignored. Your mouse and trackpad still work."
- Always name the exit, in the same view as any lock state: "Hold to unlock", "Or press Ctrl + Alt + U".
- Buttons are verb + object: "Lock keyboard", "Open System Settings", "Force unlock".
- Times: "30 s", "2 min", "1:42". Never "2 minute(s)".
- Permissions say what they are for and that nothing is recorded. No fear words ("unsafe", "threat").
- No emoji, no exclamation marks.

Real copy to reuse:

| Where | Copy |
| --- | --- |
| Main action | Lock keyboard |
| Arming | Locking in 3 s · Cancel |
| Overlay headline | Wipe away |
| Overlay line | Key presses are being ignored. Your mouse and trackpad still work. |
| Unlock hint | Hold for 1.5 seconds with the mouse or trackpad |
| After unlock | Keyboard unlocked |
| Lock failed | Couldn't lock the keyboard. Hushboard needs Accessibility access. |

## Visual foundations

**Colour.** One brand hue, `seal` (a deep teal), and it means *locked*. Use it for the primary action, the hold fill, the countdown arc and selected states, and nowhere decorative. `suds` is its tint, used as the locked wash and swallowed keys, with `on-suds` text. Text on a `seal` fill is `on-seal`, never literal white (it is dark in the dark theme). Neutrals (`surface`, `surface-raised`, `surface-sunken`, `ink`, `ink-muted`) are cool greys biased toward the teal. `caution` marks arming and the final 10 s, `danger` marks errors and Force unlock. Both always come with words.

**Type.** Three families. `display` (Bricolage Grotesque) appears only in `title-lg` and `title`. `sans` (Instrument Sans) for all UI text: `body`, `body-strong`, `label`, `caption`, `eyebrow`. `mono` (JetBrains Mono) for the `timer` and `keycap` styles, with tabular digits. Load all three from Google Fonts; in the packaged app, bundle the font files so it works offline.

**Spacing.** 4 px grid: `space-1` through `space-12`. Panels pad `space-4`; sections sit `space-6` apart; the lock overlay uses `space-8` gaps and `space-12` outer padding.

**Shape.** `radius-key` (7 px) is the signature corner, taken from a keycap, and is used on keys and segments. `radius-md` for buttons and rows, `radius-lg` for panels and the lock card, `radius-pill` for pills, switches and the HoldButton.

**Depth.** Borders, not shadows. Panels use `line`; interactive controls use `line-strong` (3:1). Only the floating lock card and menus take the `raised` shadow. Keycaps take `key-rest`, a 2 px travel edge that disappears (`key-down`) when pressed.

**Motion.** `motion-fast` for hover and press, `motion-slow` for the overlay fade. The HoldButton fill is the one deliberate animation. Respect `prefers-reduced-motion`: drop transitions, but keep the hold fill, since it is the progress readout.

**Focus.** Every control shows a 2 px solid `focus-ring` (alias of `ink`) with a 2 px offset. It reaches at least 3:1 on every surface in both themes.

**Safety timings are tokens.** `arm-delay` (3 s) between pressing Lock and the lock starting; `hold-to-unlock` (1500 ms); `caution-window` (10 s). Read them from tokens; never hard-code them.

## Layout

- Main window: about 420 × 560 px, one column. Header (app name in `title` + StatusPill), then sections labelled with `eyebrow`: DURATION (DurationPicker), KEYBOARDS (DeviceRow list), then the primary `hb-btn--lg` "Lock keyboard" pinned to the bottom.
- First run: one PermissionCard per missing permission comes before everything else, and "Lock keyboard" stays disabled until they are granted.
- Lock: LockOverlay on every display.
- Tray / menu bar: StatusPill text plus "Lock for 2 min", "Lock until I unlock", "Open Hushboard", "Quit".

## Iconography

Hugeicons free set, stroke rounded: 24 px grid, 1.5 px stroke, round caps and joins, drawn in `currentColor` (MIT licence). The 25 icons this product uses are in the Icons group, with a table saying which icon goes where. Inline them as `<svg>` so they take the text colour (`ink`, or `on-seal` inside a primary button); through `<img>` they render black. Sizes: 18 px in buttons, 20 px in rows and HoldButton, 22 px in PermissionCard tiles. Never mix in another icon family; when you need a new icon, take it from the same Hugeicons set. It has no Linux glyph, so write "Linux" as text. There is no logo yet, so set the name in `title` type.

## Components

Button, HoldButton, StatusPill, DurationPicker, Countdown, Keycap, DeviceRow, Switch, PermissionCard, LockOverlay. Markup and classes are in each component's guidelines; styles are in `components/bundle.css` (prefix `hb-`), and every value in it comes from the tokens.
