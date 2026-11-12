# Third-party notices

Hushboard is MIT licensed (see [LICENSE](LICENSE)). It includes or builds on the following work, each under its own licence.

## Bundled in this repository

| Work | Where | Licence |
| --- | --- | --- |
| [Hugeicons](https://hugeicons.com) free icon set (stroke rounded), via [`@iconify-json/hugeicons`](https://github.com/iconify/icon-sets) | `design-system/project/assets/Icons/`, tray icons in `src-tauri/icons/tray-src/` | MIT |

## Bundled into the app at build time

| Work | Package | Licence |
| --- | --- | --- |
| Bricolage Grotesque | `@fontsource-variable/bricolage-grotesque` | SIL Open Font License 1.1 |
| Instrument Sans | `@fontsource-variable/instrument-sans` | SIL Open Font License 1.1 |
| JetBrains Mono | `@fontsource/jetbrains-mono` | SIL Open Font License 1.1 |
| Tauri and the Rust and npm dependencies in `Cargo.lock` and `package-lock.json` | various | MIT and/or Apache-2.0 (see each package) |

## Design references

- [Karabiner-Elements](https://github.com/pqrs-org/Karabiner-Elements) (Unlicense, public domain): the macOS helper's design (an app bundle with its own identity, asking for Input Monitoring from the user's session, restarting on grant, seizing devices through IOKit) follows its approach. No Karabiner code is copied.
