# Contributing to Hushboard

Thanks for helping. Hushboard is small on purpose: one job (lock the keyboard while you clean it), done safely on three operating systems. Contributions of every size are welcome.

## Ways to help

- **Test on your hardware.** Windows and Linux (X11 and Wayland, GNOME and KDE) need the most testing. A report that says "worked on X with Y keyboard" is useful.
- **Report bugs** with the [bug report form](https://github.com/tekcify/hushboard/issues/new/choose). Include your OS version, keyboard type and what the panel showed.
- **Suggest features** with the feature request form. Explain the problem first, then the idea.
- **Fix something.** Issues labelled `good first issue` are a good start.
- **Security issues:** don't open an issue. See [SECURITY.md](SECURITY.md).

## Set up

You need Node.js 20+, Rust stable, and [Tauri's prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
git clone git@github.com:tekcify/hushboard.git
cd hushboard
npm install
npm run tauri dev
```

- `npm run dev` serves the UI in a browser with a simulated lock, handy for UI work. The README lists the URL options for previewing each state.
- macOS: to test the keyboard helper across rebuilds without re-approving Input Monitoring each time, set up the local signing certificate in [docs/dev-signing.md](docs/dev-signing.md).
- Linux: add yourself to the `input` group (`sudo usermod -aG input $USER`, then log out and in).

## Before you open a pull request

```bash
npm run build                                   # type-check and build the UI
cargo clippy --workspace --all-targets          # lint Rust (no new warnings, please)
cargo check -p keylock --target x86_64-pc-windows-msvc       # if you touched crates/keylock
cargo check -p keylock --target x86_64-unknown-linux-gnu     # (rustup target add … once)
```

CI runs the build and Clippy on macOS, Windows and Linux for every pull request.

## How the code is organised

| Area | Where | Notes |
| --- | --- | --- |
| Keyboard locking | `crates/keylock` | One module per OS behind a small API (`engage`, `Lock`, `keyboards`, `permissions`, `snapshot`). Keep platform code inside its module. |
| macOS helper | `crates/keylock/src/mac_helper.rs`, `mac_hid.rs` | Runs as root. Changes here get extra review (see below). Bump `VERSION` when its behaviour or protocol changes, so the app offers **Update helper**. |
| App state and commands | `src-tauri/src/lib.rs` | The lock state machine and the live system watcher. |
| Tray, panel, island | `src-tauri/src/shell.rs` | Where Hushboard appears on each OS. |
| UI | `src/`, `index.html`, `island.html`, `overlay.html` | Plain TypeScript, no framework. |
| Design system | `design-system/project/` | Tokens (`tokens.json`), component CSS (`components/bundle.css`) and guidelines. The app builds its CSS variables from `tokens.json` at startup, so change values there, never as hard-coded colours. |

## Guidelines

### Safety first

Hushboard takes away someone's keyboard. Every change must keep these true:

1. There is always a visible way out that uses the pointer, and the pointer is never locked.
2. Ctrl + Alt + U (⌃⌥U) always unlocks.
3. A lock never outlives the app: if Hushboard quits or crashes, the keyboard comes back.
4. Nothing typed is stored, logged or sent. Key legends are shown, never recorded.
5. Never silently "lock" when the lock isn't really holding the keyboard. Fail with a clear message instead.

### The macOS helper

It runs as root, so:

- Keep it minimal. New features belong in the app, not the helper.
- Keep the checks on who may connect (`peer_allowed`), the per-connection lock lifetime, and the 30-minute cap.
- Installation must stay verified: the app builds and signs the bundle, and the installer checks its digest and signature before installing.

### Code

- **Rust:** idiomatic, `cargo clippy` clean. Prefer clear names and short doc comments that say *why*.
- **TypeScript:** strict mode, no new dependencies without a good reason.
- **UI copy:** sentence case, plain words, say what will happen ("Lock keyboard", "Hold to unlock"). Follow the voice in `design-system/project/README.md`.
- **Icons:** only from Nucleo's free Glass set, which is under the Nucleo license, not MIT. Hushboard may ship at most 100 Nucleo icons in total. Take the icon from Nucleo yourself, keep its copyright notice, add it to `design-system/project/assets/IconsGlass/`, map it in `src/icons.ts` and list it in that folder's README.
- **Accessibility:** real buttons and labels, visible focus, 4.5:1 text contrast in both themes.

### Commits and pull requests

- One logical change per pull request. Small is easier to review.
- Write commit messages in the imperative: `Show the island on every monitor`, not `Showed…`.
- Describe what you tested and on which OS in the pull request template.
- If the change is visible, add a screenshot or a short recording.

## Licence

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
