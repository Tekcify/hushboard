# Changelog

All notable changes to Hushboard are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
