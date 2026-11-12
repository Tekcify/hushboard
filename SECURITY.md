# Security policy

Hushboard intercepts keyboard input, and on macOS it installs a helper that runs as root. We take reports about it seriously.

## Reporting a vulnerability

**Please don't open a public issue.** Report privately through GitHub instead:

1. Go to the repository's **Security** tab → **Report a vulnerability** ([direct link](https://github.com/tekcify/hushboard/security/advisories/new)).
2. Describe the issue, the affected OS and version, and steps to reproduce. A proof of concept helps.

We aim to acknowledge reports within 3 working days and to agree on a fix and disclosure timeline with you. We credit reporters in the advisory unless you'd rather stay anonymous.

## Supported versions

Hushboard is pre-1.0. Security fixes go into the latest release and `main`.

## What's in scope

Especially:

- **The macOS keyboard helper** (`crates/keylock/src/mac_helper.rs`, `mac_hid.rs`): privilege escalation, a way for another user or process to connect to it, hold the keyboard or keep it locked, or to install or replace the helper.
- **Keystroke exposure:** any way typed keys could be stored, logged, sent, or read by another process through Hushboard.
- **Lock-out:** any way a lock can outlive the app, ignore Ctrl + Alt + U, or leave no pointer way out.
- The Windows hook and Linux device grab in `crates/keylock`.

Out of scope: issues that need an attacker who already has root or administrator rights, and the operating systems' own behaviour (for example Ctrl + Alt + Del always getting through on Windows, which is by design).

## How the macOS helper is protected

- It listens on a Unix socket and accepts only root and the user logged in at the console (checked per connection with `getpeereid`).
- A lock lives only as long as the connection that made it, and never longer than 30 minutes.
- It refuses to lock without Input Monitoring permission rather than pretending.
- The app builds and signs the helper bundle; the installer (run once with the user's password) copies it into a root-only folder and installs it only if its digest matches what the app built and its code signature verifies. Installed files are owned by root.
