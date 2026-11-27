// One place for links and the current release, so a new version is a one-line change.
export const version = "1.0.0";

const repo = "https://github.com/Tekcify/hushboard";
const release = `${repo}/releases/download/v${version}`;

export const links = {
  repo,
  releases: `${repo}/releases/latest`,
  changelog: `${repo}/blob/main/CHANGELOG.md`,
  installGuide: `${repo}/blob/main/docs/installing.md`,
  contributing: `${repo}/blob/main/CONTRIBUTING.md`,
  security: `${repo}/blob/main/SECURITY.md`,
  license: `${repo}/blob/main/LICENSE`,
  buildFromSource: `${repo}#readme`,
};

export const brewCommand = "brew install --cask tekcify/tap/hushboard";

export type Platform = "mac" | "windows" | "linux";

export const downloads: Record<Platform, { label: string; href: string }> = {
  mac: { label: "Download for macOS", href: `${release}/Hushboard_${version}_universal.dmg` },
  windows: { label: "Download for Windows", href: `${release}/Hushboard_${version}_x64-setup.exe` },
  linux: { label: "Get it for Linux", href: links.releases },
};
