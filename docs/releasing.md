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

## Homebrew

The cask lives in [tekcify/homebrew-tap](https://github.com/tekcify/homebrew-tap) (`brew install --cask tekcify/tap/hushboard`) and installs the release's `Hushboard_<v>_universal.dmg`. Upload the notarized DMG and its checksum before publishing, because the cask takes the DMG's SHA-256 from `SHA256SUMS.txt`.

When a stable release is published, the **Update feed** workflow's `cask` job sets the cask's version and checksum and pushes to the tap. It needs a `HOMEBREW_TAP_TOKEN` secret: a fine-grained token with **Contents: read and write** on `tekcify/homebrew-tap` only. Without it the job skips, and betas never change the cask. The app updates itself, so the cask has `auto_updates true` and `brew upgrade` leaves installed copies alone.

To update the cask by hand, change `version` and `sha256` in `Casks/hushboard.rb` and run `brew audit --cask --strict --online tekcify/tap/hushboard` before pushing.

## The update-signing key

Every update file is signed with Hushboard's update key; the app refuses updates the key didn't sign. Its **public** half is in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). The **private** half is:

- a repository secret `TAURI_SIGNING_PRIVATE_KEY` (with `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, empty if the key has none), and
- an offline backup held by Tekcify maintainers. Treat it like a password: if it's lost, existing installs can't verify new updates and users must reinstall by hand; if it leaks, rotate it in a release that ships the new public key.

To create a new key (only for rotation):

```bash
npx tauri signer generate -w ~/.tauri/hushboard-updater.key
```

Put the contents of `~/.tauri/hushboard-updater.key` in the `TAURI_SIGNING_PRIVATE_KEY` secret and the `.pub` contents in `tauri.conf.json`.

## Code signing

### macOS (Tekcify Developer ID)

`tauri.conf.json` keeps `"signingIdentity": "-"` so contributors and CI build ad-hoc. Signed builds use Tekcify's certificate, `Developer ID Application: TEKCIFY TECHNOLOGIES LTD (44969WH79Y)`, which must be in the login keychain.

Build a signed universal app and DMG locally:

```bash
./scripts/build-macos-signed.sh
```

To notarize as well, store notary credentials for the Tekcify team once (Apple ID with an app-specific password, or an App Store Connect API key):

```bash
xcrun notarytool store-credentials hushboard --team-id 44969WH79Y
```

Then run the script with the profile name. It submits the DMG, waits, staples the DMG and the app, and checks both with Gatekeeper:

```bash
HUSHBOARD_NOTARY_PROFILE=hushboard ./scripts/build-macos-signed.sh
```

Set `TAURI_SIGNING_PRIVATE_KEY` (and its password) first if you also want the updater files.

Every macOS bundle step runs `scripts/bundle-mac-helper.mjs`, which builds the small `hushboard-keyhelper` binary from `crates/keylock`, wraps it in `Hushboard Keyboard Helper.app` and signs it with `APPLE_SIGNING_IDENTITY` (hardened runtime and timestamp), or ad-hoc when that isn't set. Tauri copies it to `Contents/Helpers/` and seals it into the app's signature, so notarizing the app covers it. When the app installs the helper, it uses this copy if it carries a Developer ID signature, which keeps the helper's Input Monitoring grant across updates. Ad-hoc builds fall back to signing a copy of the app's own executable on the user's Mac.

For signed CI builds, add `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY` and `APPLE_API_KEY_PATH` (or `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) secrets and pass them to `tauri-action` on the macOS job only.

### Windows

Not signed yet. SignPath (free for open source) or Azure Trusted Signing, configured through `bundle.windows.signCommand`.
