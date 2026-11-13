#!/usr/bin/env bash
set -euo pipefail

IDENTITY="${APPLE_SIGNING_IDENTITY:-Developer ID Application: TEKCIFY TECHNOLOGIES LTD (44969WH79Y)}"
export APPLE_SIGNING_IDENTITY="$IDENTITY"
TARGET="${HUSHBOARD_TARGET:-universal-apple-darwin}"
PROFILE="${HUSHBOARD_NOTARY_PROFILE:-}"

cd "$(dirname "$0")/.."

if ! security find-identity -v -p codesigning | grep -qF "\"$IDENTITY\""; then
  echo "Signing identity not found in the keychain: $IDENTITY" >&2
  exit 1
fi

PATH="$(dirname "$(rustup which rustc)"):$PATH"
export PATH

case "$TARGET" in
  universal-apple-darwin) rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null ;;
  *) rustup target add "$TARGET" >/dev/null ;;
esac

updater=true
if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" ]]; then
  updater=false
  echo "TAURI_SIGNING_PRIVATE_KEY is not set, so no updater files are built."
fi

config=$(printf '{"bundle":{"createUpdaterArtifacts":%s,"macOS":{"signingIdentity":"%s"}}}' "$updater" "$IDENTITY")

CI=true npx tauri build --target "$TARGET" --bundles app,dmg --config "$config"

bundle_dir="target/$TARGET/release/bundle"
app=$(find "$bundle_dir/macos" -maxdepth 1 -name '*.app' | head -n 1)
dmg=$(find "$bundle_dir/dmg" -maxdepth 1 -name '*.dmg' | head -n 1)

codesign --force --sign "$IDENTITY" --timestamp "$dmg"
codesign --verify --deep --strict "$app"
codesign --verify --strict "$dmg"

if [[ -n "$PROFILE" ]]; then
  xcrun notarytool submit "$dmg" --keychain-profile "$PROFILE" --wait
  xcrun stapler staple "$dmg"
  xcrun stapler staple "$app"
  spctl --assess --type execute --verbose=2 "$app"
  spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg"
else
  echo "HUSHBOARD_NOTARY_PROFILE is not set, so the build is signed but not notarized."
fi

echo "App: $app"
echo "DMG: $dmg"
