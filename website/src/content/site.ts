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

// Every build, for the "other downloads" menu. File names follow docs/installing.md.
export const allDownloads: { platform: Platform; name: string; note: string; href: string }[] = [
  { platform: "mac", name: "macOS", note: ".dmg · Apple silicon and Intel", href: downloads.mac.href },
  { platform: "windows", name: "Windows", note: ".exe · 64-bit installer", href: downloads.windows.href },
  { platform: "linux", name: "Linux · Debian, Ubuntu", note: ".deb · x86-64", href: `${release}/Hushboard_${version}_amd64.deb` },
  { platform: "linux", name: "Linux · Fedora, openSUSE", note: ".rpm · x86-64", href: `${release}/Hushboard-${version}-1.x86_64.rpm` },
  { platform: "linux", name: "Linux · any distribution", note: "AppImage · x86-64", href: `${release}/Hushboard_${version}_amd64.AppImage` },
];
