## What this changes

<!-- One or two sentences. Link the issue if there is one: "Fixes #123". -->

## How I tested it

<!-- Which OS and version, which keyboards, and what you did. -->

- [ ] macOS
- [ ] Windows
- [ ] Linux (X11 / Wayland)

## Checklist

- [ ] `npm run build` and `cargo clippy --workspace --all-targets` pass without new warnings.
- [ ] The safety rules in CONTRIBUTING.md still hold (pointer way out, Ctrl + Alt + U, no lock outlives the app, nothing typed is stored).
- [ ] If I changed the macOS helper's behaviour or protocol, I bumped `VERSION` in `mac_helper.rs`.
- [ ] UI changes use the design system tokens and include a screenshot.
- [ ] I added a line to `CHANGELOG.md` under Unreleased (if users will notice the change).
