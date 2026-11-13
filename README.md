# Hushboard

**Lock your keyboard while you clean it.** Wipe the keys without typing into whatever's open. Your mouse and trackpad keep working, and the way out is always on screen.

Hushboard is a small, open-source desktop app for **macOS, Windows and Linux**, built with [Tauri](https://tauri.app) (Rust + web UI).

> **Status:** 1.0. **[Download the latest release](https://github.com/tekcify/hushboard/releases/latest)** for macOS, Windows or Linux, then follow [Installing Hushboard](docs/installing.md). Builds aren't signed by Apple or Microsoft yet, so your system warns you on first launch; the guide shows how to get past that. Hushboard updates itself once installed.

## What it does

- **Locks the keyboard for a set time** (30 s to 5 min, or until you unlock), after a 3-second countdown you can cancel.
- **Three ways out, always:** hold the on-screen **Hold to unlock** button for 1.5 s, press **Ctrl + Alt + U** (⌃⌥U on a Mac), or wait for the timer. The pointer is never locked.
- **Shows the keys you hit** as you wipe, so you can see it's working. Nothing typed is stored or sent anywhere.
- **Lives where your OS keeps small tools:**

| | Idle | While locked |
| --- | --- | --- |
| **macOS** | Menu bar icon (no Dock icon). Click for the panel, right-click for quick locks. | A black island grows out of the camera notch (a top-centre pill on Macs without one). |
| **Windows** | Tray icon. Click for the panel, right-click for quick locks. | A pill floats at the top of every monitor. |
| **Linux** | Panel indicator with quick locks, plus a normal window. | A card in the middle of each monitor. |

Prefer the whole screen covered? Turn on **Cover the screen while locked**.

## How it locks the keyboard

| OS | Method | What you allow once |
| --- | --- | --- |
| **macOS** | **Keyboard helper** (recommended): a small background service that takes exclusive control of the keyboard hardware through IOKit, like [Karabiner-Elements](https://github.com/pqrs-org/Karabiner-Elements). Unaffected by apps that turn on secure keyboard entry, and can lock the built-in keyboard alone. | Your Mac password to install it, then **Hushboard Keyboard Helper** in System Settings → Privacy & Security → Input Monitoring. The app walks you through both. |
| | *Fallback without the helper:* an event tap that drops key events. | Accessibility and Input Monitoring for Hushboard. Stops working while another app holds secure keyboard entry (Hushboard tells you which). |
| **Windows** | A low-level keyboard hook (`WH_KEYBOARD_LL`). Locks every keyboard at once. Ctrl + Alt + Del always gets through. | Nothing. |
| **Linux** | An exclusive grab (`EVIOCGRAB`) of each chosen keyboard device. Works on X11 and Wayland, and can lock the built-in keyboard alone. | Read access to `/dev/input`: `sudo usermod -aG input $USER`, then log out and in. |

The app watches all of this live: if a permission is switched off, a keyboard is plugged in, or something blocks the lock, the panel says so straight away and the Lock button explains why it's disabled.

## Build and run

You need [Node.js](https://nodejs.org) 20+ and [Rust](https://rustup.rs) (stable), plus [Tauri's system dependencies](https://tauri.app/start/prerequisites/) for your OS.

```bash
git clone git@github.com:tekcify/hushboard.git
cd hushboard
npm install
npm run tauri dev
```

Release build: `npm run tauri build`. To work on the UI in a browser with a simulated lock (nothing is locked), run `npm run dev` and open <http://localhost:1420/>. Add `?shell=panel`, `?helper=needs-approval` or `?helper=missing&secure=loginwindow` to preview states, and open `island.html?platform=windows&state=locked` for the island.

### macOS keyboard helper

- Installed from the app (**Install helper**). It lives at `/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app` with a launch daemon `app.hushboard.keyhelper`.
- It only accepts connections from the logged-in user, releases the keyboard the moment the app disconnects, handles Ctrl + Alt + U itself, and never holds a lock longer than 30 minutes.
- Remove it with:

  ```bash
  sudo "/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app/Contents/MacOS/hushboard-keyhelper" --keyhelper-uninstall
  ```

- For development, create a local signing certificate so macOS keeps the helper's permission across rebuilds: [docs/dev-signing.md](docs/dev-signing.md).

## Project layout

| Path | What |
| --- | --- |
| `crates/keylock` | The native lock, one file per OS, plus the macOS helper (`mac_helper.rs`, `mac_hid.rs`). Usable on its own. |
| `src-tauri/src/lib.rs` | The lock state machine (idle → arming → locked), the live system watcher, and the commands the UI calls. |
| `src-tauri/src/shell.rs` | Tray icon and menu, the tray panel, the island windows. |
| `src/` | The web UI: `main.ts` (panel/window), `island.ts`, `overlay.ts` (full-screen view), `tokens.ts` (design tokens to CSS). |
| `design-system/` | Hushboard's design system: tokens, component CSS and guidelines, and the icons (Nucleo Glass). |
| `docs/` | [Installing](docs/installing.md), [releasing](docs/releasing.md), [prior art and how locking works on each OS](docs/research.md), [dev signing](docs/dev-signing.md). |

## Safety rules

1. A 3-second countdown before the lock starts, which you can cancel.
2. The pointer is never locked. Unlocking takes a deliberate 1.5-second hold.
3. Ctrl + Alt + U (⌃⌥U) always unlocks.
4. Timed locks are capped at 10 minutes; the macOS helper releases anything after 30.
5. Nothing typed is stored, logged or sent. The key strip shows legends only, in memory.

## Contributing

Contributions are welcome: bug reports, testing on your hardware (especially Windows and Linux), code and design. Start with [CONTRIBUTING.md](CONTRIBUTING.md). Please follow the [Code of Conduct](CODE_OF_CONDUCT.md), and report security issues privately as described in [SECURITY.md](SECURITY.md).

## Acknowledgements

- [Karabiner-Elements](https://github.com/pqrs-org/Karabiner-Elements) (public domain), whose helper design shaped Hushboard's macOS keyboard helper.
- [Nucleo](https://nucleoapp.com/svg-glass-icons) free Glass icons (© Nucleo, under the Nucleo license, not MIT), [Hugeicons](https://hugeicons.com) for the menu bar icon (MIT), [Bricolage Grotesque, Instrument Sans and JetBrains Mono](https://fontsource.org) (SIL OFL 1.1). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
- The keyboard cleaners that came before: see [docs/research.md](docs/research.md).

## License

[MIT](LICENSE) © Tekcify and the Hushboard contributors.
