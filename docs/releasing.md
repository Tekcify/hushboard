# Releasing Hushboard

How a version gets from `main` to users' machines. For maintainers.

## Overview

1. Bump the version and changelog in a pull request, merge it.
2. Push a tag `vX.Y.Z` (or `vX.Y.Z-beta.N`). The **Release** workflow builds installers for macOS (universal), Windows and Linux, signs the update files, and creates a **draft** GitHub Release with everything attached plus `SHA256SUMS.txt`.
3. Review the draft: download and try the installers, check the notes.
4. **Publish** it. The **Update feed** workflow copies its `latest.json` to the rolling `updater` release, and installed copies of Hushboard pick the update up within 6 hours (or straight away via **Check for updates**).

Drafts are never offered to users. Only publishing changes the update feed.

## 1. Version and changelog

The version lives in **one place**: `version` in `package.json` (Tauri reads it from there). Keep `src-tauri/Cargo.toml` in step with it.

- Betas: `0.2.0-beta.1`, `0.2.0-beta.2`, … (marked as pre-releases automatically).
- Stable: `0.2.0`.
- In `CHANGELOG.md`, move the **Unreleased** entries under a new heading `## [0.2.0] - YYYY-MM-DD`.
- If the macOS helper's behaviour or protocol changed, check that `VERSION` in `crates/keylock/src/mac_helper.rs` was bumped.

## 2. Tag

```bash
git switch main && git pull
git tag v0.2.0-beta.1
git push origin v0.2.0-beta.1
```

The tag must match `package.json`'s version with a `v` in front. To rebuild an existing tag, run the Release workflow by hand (Actions → Release → Run workflow) and enter the tag.

## 3. Review the draft

Under Releases you'll find the draft "Hushboard v0.2.0-beta.1" with:

| Asset | What |
| --- | --- |
| `Hushboard_<v>_universal.dmg` | macOS installer |
| `Hushboard_universal.app.tar.gz` + `.sig` | macOS update file |
| `Hushboard_<v>_x64-setup.exe` + `.sig` | Windows installer, also the update file |
| `Hushboard_<v>_amd64.AppImage` + `.sig`, `.deb`, `.rpm` | Linux. Betas have no `.rpm`: RPM versions can't contain `-` |
| `latest.json` | update manifest |
| `SHA256SUMS.txt` | checksums of all of the above |

Install at least the macOS build and lock once before publishing.

## 4. Publish

Click **Publish release**. Check that the **Update feed** workflow succeeded: the `updater` release's `latest.json` should now show the new version.

## The update-signing key

Every update file is signed with Hushboard's update key; the app refuses updates the key didn't sign. Its **public** half is in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). The **private** half is:

- a repository secret `TAURI_SIGNING_PRIVATE_KEY` (with `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, empty if the key has none), and
- an offline backup held by Tekcify maintainers. Treat it like a password: if it's lost, existing installs can't verify new updates and users must reinstall by hand; if it leaks, rotate it in a release that ships the new public key.

To create a new key (only for rotation):

```bash
npx tauri signer generate -w ~/.tauri/hushboard-updater.key
```

Put the contents of `~/.tauri/hushboard-updater.key` in the `TAURI_SIGNING_PRIVATE_KEY` secret and the `.pub` contents in `tauri.conf.json`.

## Code signing (planned)

Beta builds are ad-hoc signed on macOS and unsigned on Windows, so users see a first-launch warning ([docs/installing.md](installing.md) explains it). To sign:

- **macOS:** an Apple Developer ID Application certificate and notarisation. Add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_ID`, `APPLE_PASSWORD` and `APPLE_TEAM_ID` secrets, pass them to `tauri-action`, and remove `"signingIdentity": "-"` from `tauri.conf.json`. Set `HUSHBOARD_SIGN_IDENTITY` so the keyboard helper is signed with the same identity.
- **Windows:** SignPath (free for open source) or Azure Trusted Signing, configured through `bundle.windows.signCommand`.
