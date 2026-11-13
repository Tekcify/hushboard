# Icons: Nucleo Glass

14 icons from [Nucleo's free Glass set](https://nucleoapp.com/svg-glass-icons) (24 px grid, layered glass: a solid back shape, a frosted front and a light edge), taken from the `nucleo-glass` 1.4.1 npm package and converted to plain SVG. File names are Nucleo's names, so you can find more in the [Nucleo web app](https://nucleoapp.com/app/?library=glass).

## Licence: not MIT

These icons are © Nucleo and used under the [Nucleo license](https://nucleoapp.com/license), not Hushboard's MIT licence. It allows up to **100 Nucleo icons** in publicly available source, such as this repository, with Nucleo's copyright notice kept in the files (each SVG starts with it). Don't use them to build an icon library, and don't let users browse or pick from them inside the app. Anyone adding icons to Hushboard should take them from Nucleo themselves (the Glass set is free) and keep the total under 100.

## Colour

The icons don't use `currentColor`. They read five CSS custom properties, which `src/app.css` sets from the design tokens:

| Property | Token | Part |
| --- | --- | --- |
| `--nc-gradient-1-color-1`, `-2` | `glass-back-1`, `-2` | the solid back shape (top, bottom) |
| `--nc-gradient-2-color-1`, `-2` | `glass-front-1`, `-2` | the frosted front |
| `--nc-light` | `glass-edge` | the edge highlight |

Neutral glass (umber by day, sand by night) is the default. Clay (`glass-clay-*`) marks something locked, ready or welcoming; crimson (`glass-danger-*`) a problem. On a solid fill (the Lock button, the island) the back shape takes the fill's text colour.

Each SVG uses ids for its gradients, masks and filters, written as `__UID__…`. `src/icons.ts` replaces the placeholder with a fresh prefix every time it inlines an icon, so two copies on one page don't share them. Always inline through `icon()`; don't paste the files directly.

## Where each icon is used

The app asks for icons by role (`src/icons.ts` maps each role to a file):

| Role (`IconName`) | File | Used for |
| --- | --- | --- |
| `square-lock-02` | `Lock` | Lock keyboard, locked state, island |
| `square-unlock-02` | `Key` | Hold to unlock |
| `keyboard` | `Keyboard` | Keyboards in general, "Show the keys you press", helper card |
| `laptop` | `Laptop` | Built-in keyboard row |
| `usb` | `Connect` | USB keyboard row |
| `bluetooth` | `Signal` | Bluetooth keyboard row |
| `shield-check`, `tick-02` | `CircleCheck` | Permission allowed, done, up to date |
| `shield-alert`, `alert-02` | `TriangleWarning` | Permission off, lock failed, secure keyboard entry |
| `circle-arrow-reload-01` | `Refresh` | Update available |
| `cancel-01` | `DeleteX` | Cancel arming |
| `sparkles` | `Sparkle` | Welcome, "All clean" |
| `brush-cleaning` | `Feather` | The brand mark (a feather duster) |
| `moon-02` | `EyeClosed` | Cover the screen |
| `login-03` | `Bolt` | Open at login |

The menu bar and tray icons (`src-tauri/icons/tray-src/`) are not Glass: macOS needs a single-colour template image there, so they stay a plain keyboard glyph.
