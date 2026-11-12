# Icons

25 icons from Hugeicons' free set (stroke rounded, 24 px grid, 1.5 px stroke, MIT licence, taken from the `@iconify-json/hugeicons` 1.2.35 package). File names match the Hugeicons names, so you can find more in the same style at hugeicons.com or the Iconify set `hugeicons`.

**Ink:** every file is drawn in `currentColor`. Pasted inline as `<svg>`, an icon takes the text colour of its parent (`ink` by default, `on-seal` inside a primary button). Loaded through `<img>`, it renders black, so in the app inline the SVG (or import it as a component) rather than using `<img>`.

**Sizes:** 18 px inside buttons, 20 px in rows and HoldButton, 22 px in PermissionCard tiles. Never scale the stroke; keep the 1.5 px.

| Icon | Use it for |
| --- | --- |
| `square-lock-02` | Lock keyboard (button, tray item), locked state |
| `square-unlock-02` | Hold to unlock, unlocked toast |
| `keyboard` | The keyboard in general, onboarding illustration |
| `keyboard-off` | Tray/menu-bar icon while locked |
| `laptop` | Built-in keyboard row |
| `usb` | USB keyboard row |
| `bluetooth` | Bluetooth keyboard row |
| `timer-02` | Duration section, auto-unlock |
| `cursor-hold-01` | "Hold with the mouse" hint, onboarding |
| `touchpad-01` | "Your trackpad still works" line |
| `shield-check` | Permission granted |
| `shield-alert` | Permission missing |
| `alert-02` | Lock failed, force-unlock warnings |
| `information-circle` | Platform caveats (Wayland, admin windows) |
| `settings-02` | Settings |
| `circle-arrow-reload-01` | Check permission again |
| `cancel-01` | Cancel arming, close |
| `tick-02` | Done, unlocked confirmation |
| `sparkles` | "All clean" end state |
| `brush-cleaning` | App empty state and onboarding |
| `moon-02` | Setting: dim the screen while locked |
| `volume-high` | Setting: play a sound when the lock ends |
| `login-03` | Setting: start at login |
| `apple` | macOS label in docs and download pages |
| `windows-new` | Windows label in docs and download pages |

The free set has no Linux or Tux glyph, so write "Linux" as text. Use the Apple and Windows marks only to name the platform, never as decoration.
