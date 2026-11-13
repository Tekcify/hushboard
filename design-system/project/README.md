Hushboard is a small desktop app for macOS, Windows and Linux that locks the keyboard so you can wipe it down. The pointer keeps working, and the way out is always on screen. Every screen exists to answer three questions: is it locked, when does it end, and how do I get out now.

## Content fundamentals

- Voice: calm, plain, brief. A helpful tool, not a security product. Second person ("Your mouse still works"), no "we".
- Sentence case everywhere: buttons, titles, menu items, section labels. (`eyebrow` is uppercase only on the branded surfaces.)
- Short, like the system's own settings. Labels are two or three words ("Cover the screen", "Open at login"); help text is one sentence; a switch already says on or off, so its row doesn't repeat it.
- One fact per sentence, and the instruction before the reason: "Switch on Hushboard Keyboard Helper in Input Monitoring." not "In order for Hushboard to work, you need to…".
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
| Under it | Locks after 3 s · ⌃⌥U unlocks |
| Arming | Hands off the keyboard · Cancel |
| Status | Unlocked · Locking in 3 s · Locked · Setup needed |
| Sections | Unlock after · Keyboards · Options |
| Settings | Cover the screen · Show the keys you press · Launch sound · Open at login |
| Overlay headline | Wipe away |
| Overlay line | Key presses are being ignored. Your mouse and trackpad still work. |
| Unlock hint | Hold for 1.5 seconds with the mouse or trackpad |
| After unlock | Keyboard unlocked |
| Lock failed | Couldn't lock the keyboard. Hushboard needs Accessibility access. |
| Helper off | Switch on Hushboard Keyboard Helper in Input Monitoring. Hushboard notices on its own. |

## Visual foundations

**Two registers.** The everyday surfaces (the menu bar or tray panel, and the Linux window) are *native*: they borrow the system's materials, font and control sizes so Hushboard sits quietly beside the system's own menu bar extras, like Karabiner-Elements or Blip. On macOS the panel is the system's frosted popover material with the native window shadow, and its colours switch to the translucent `material-*` tokens so the frost shows through. The moments you look at while cleaning (the island, the lock overlay, the countdown) are *branded*: solid surfaces, the display face and the clay, readable at arm's length.

**Native panel rules.** The `ui` family (the system font: SF Pro, Segoe UI, Ubuntu…) at 13 px; section labels at 11 px, semibold, sentence case; one rounded group per section with hairlines between rows; small switches and a 22 px segmented control; one 30 px primary button. Colour only marks state: clay on switches that are on, the Lock button and the locked status; `caution` and `danger` on the words that need them. No tinted rows, no icon tiles.

**Colour.** The palette is Clay and sand: one brand hue, `seal` (a terracotta clay), and it means *locked*. Use it for the primary action, the hold fill, the countdown arc and selected states, and nowhere decorative. `suds` is its tint, used as the locked wash and swallowed keys, with `on-suds` text. Text on a `seal` fill is `on-seal`, never literal white (it is dark in the dark theme). Neutrals (`surface`, `surface-raised`, `surface-sunken`, `ink`, `ink-muted`) are warm sand and umber tones biased toward the clay. `caution` (an ochre, deliberately yellow so it never reads as the clay) marks arming and the final 10 s; `danger` (a crimson, cooler than the clay) marks errors and Force unlock. Both always come with words.

**Type.** Four families. `ui` is the system font, for the native panel and window. The branded surfaces use the other three. `display` (Bricolage Grotesque) appears only in `title-lg` and `title`. `sans` (Instrument Sans) for all UI text: `body`, `body-strong`, `label`, `caption`, `eyebrow`. `mono` (JetBrains Mono) for the `timer` and `keycap` styles, with tabular digits. Load all three from Google Fonts; in the packaged app, bundle the font files so it works offline.

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
- Island: wings either side of the notch while arming and done; a compact card below it while locked, with the ring and time, "Keyboard locked", a one-line caption (replaced by the keys you press while you type) and "Hold to unlock" with the escape shortcut. Width (420–640 px), corner radius (0–48 px), size (small, medium, large) and, on macOS, which layer it sits on (everything, or app windows under the menu bar) are user settings, stored by the app and applied live. The preview stays up while a slider is held.
- Automatic (macOS): "Detect cleaning", off by default. About nine different keys within half a second start a lock with `auto-arm-delay` and Cancel. Only timing is counted, never which keys.
- Welcome tour: a 520 × 680 window on first launch and from the tray menu. Five steps (welcome, three ways out, set up the keyboard lock where the OS needs it, defaults, where Hushboard lives), one idea each, sentence case, no exclamation marks. A soft key tap, a rising fifth and a quiet "shh" play on launch (synthesised in `src/sound.ts`, off with the Launch sound switch, silent when started at login).
- Tray / menu bar: StatusPill text plus "Lock for 2 min", "Lock until I unlock", "Open Hushboard", "Welcome tour", "Quit".

## Iconography

Nucleo's free Glass set: 24 px grid, layered glass (a solid back shape, a frosted front, a light edge), so the icons echo the frosted panel they sit on. They're used everywhere inside the app, in `assets/IconsGlass/` with a table of which icon goes where, and are © Nucleo under the Nucleo license, not MIT (up to 100 icons in public source; read that folder's README before adding any). Always inline them through `icon()`, which gives each copy its own gradient ids. Colour comes from the `glass-*` tokens, not the text colour: neutral by default, clay where something is locked, ready or welcoming, crimson for a problem, and the fill's text colour on a solid button. Sizes: 14–15 px in buttons, 16 px in rows, 18–20 px in cards and the island. Never mix in another family inside the app; the one exception is the menu bar / tray icon, which macOS requires to be a single-colour template image. The brand mark is the clay logo (`src/brand.ts`, `src-tauri/app-icon.svg`): a cream sweep and two sparkles on a clay tile, used as-is and never recoloured.

## Components

Button, HoldButton, StatusPill, DurationPicker, Countdown, Keycap, DeviceRow, Switch, PermissionCard, LockOverlay. Markup and classes are in each component's guidelines; styles are in `components/bundle.css` (prefix `hb-`), and every value in it comes from the tokens.
