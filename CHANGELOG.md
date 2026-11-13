# Changelog

All notable changes to Hushboard are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- A welcome tour on first launch: the three ways out, setting up the keyboard lock, your defaults, and where to find Hushboard. It is also in the tray menu as "Welcome tour".
- "Detect cleaning" (macOS, off by default): when about nine different keys are pressed within half a second, as a cloth wiping across the keys would, Hushboard starts a lock by itself with a short 1.5 second countdown and Cancel. Only the timing of presses is counted, never which keys. It needs Input Monitoring for the app, and stays quiet for 10 seconds after an unlock.
- "Stay on top of" for the island (macOS): Everything, or App windows to sit under the menu bar.
- A soft launch sound, with a "Launch sound" switch in the panel. It stays quiet when Hushboard starts at login.
- An Island section in the panel to set the island's width, corner radius and size, with a live preview while you adjust it. On Windows and Linux it styles the pill and the card.
- Smoother state changes in the panel, the island and the lock screen.

### Fixed

- The island preview no longer closes while you drag the width slider, and the panel stays open while the island is shown.

### Changed

- The locked island is more compact: the lock status, the time left and the ways to unlock, with the keys you press taking the place of the caption while you type.
- The panel's last section is now called Options.
- The macOS keyboard helper ships inside the app, signed by Tekcify. Updating from 1.0.0 asks you to update the helper and switch it on in Input Monitoring once more; after that, updates keep it switched on.

## [1.0.0] - 2026-11-13

The first stable release, with a redesigned menu bar panel. Installed betas update to it on their own.

### Changed

- The macOS panel sits on the system's frosted popover material, with the native window shadow and a native fade on open and close, and the pointer under the menu bar icon is part of the frosted shape.
- New look: the Clay and sand palette, one font throughout the panel (Onest), grouped rows, small switches and shorter wording everywhere.
- The Lock button is a keycap, and every icon in the app is now from Nucleo's free Glass set.
- The panel fits your screen instead of stopping at a fixed height. Only its middle scrolls, inside its frame, and the panel no longer bounces past its edges.

### Fixed

- Locking was blocked on a fresh install whose keyboard helper was fully set up, because the Lock button also asked for the app's own permissions.
- "Check for updates" showed an error before the first release was published; it now says Hushboard is up to date.
- The panel's content could start out of line with its frame when it opened at launch.

## [0.1.0-beta.1] - 2026-11-12

First public beta.

### Added

- Keyboard lock for macOS, Windows and Linux with a 3-second cancellable countdown, timed or open-ended locks, hold-to-unlock (1.5 s) and the Ctrl + Alt + U escape.
- macOS keyboard helper: a root launch daemon that seizes keyboards through IOKit, unaffected by secure keyboard entry, with one-click install, Input Monitoring guidance, signed bundle and verified install.
- macOS event-tap fallback when the helper isn't installed, with secure-keyboard-entry detection.
- Windows low-level keyboard hook; Linux `EVIOCGRAB` per keyboard (X11 and Wayland).
- Menu bar and tray app: a panel that opens under its icon (with a caret on macOS) and stays clear of the Dock or taskbar, a quick-lock menu, and a live tray icon.
- Island while locked: grows from the notch on macOS, a floating pill on Windows, a centred card on Linux; optional full-screen cover.
- Live system watcher: permissions (including revocation), helper state, keyboards and secure input update the UI as they change.
- Installers: universal macOS `.dmg`, Windows per-user `.exe` (NSIS), Linux AppImage and `.deb` (plus `.rpm` from the first stable release; RPM versions can't contain `-`), built by the release workflow onto a draft GitHub Release with `SHA256SUMS.txt`.
- In-app updates: signed with Hushboard's update key and verified before installing, checked shortly after launch and every 6 hours (never during a lock), with an "Update available" card and "Check for updates".
- Start at login (stays in the menu bar or tray without opening the panel) and a first-run welcome.
- Hushboard design system (tokens, components, Hugeicons icon set), install guide and release runbook.
