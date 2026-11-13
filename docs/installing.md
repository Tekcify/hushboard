# Installing Hushboard

Download the file for your system from the [latest release](https://github.com/tekcify/hushboard/releases). Each release lists a `SHA256SUMS.txt` to check your download against.

> **The macOS app is signed and notarized by Apple.** The Windows installer isn't signed by Microsoft yet, so Windows warns you the first time you run it. The steps below get past that safely. Once Hushboard is installed, it updates itself, and updates are signed by the Hushboard team and checked before installing.

## macOS (11 Big Sur or later, Apple Silicon or Intel)

With [Homebrew](https://brew.sh), one command does steps 1 to 3:

```bash
brew install --cask tekcify/tap/hushboard
```

Without Homebrew:

1. Download `Hushboard_<version>_universal.dmg` and open it.
2. Drag **Hushboard** into **Applications**.
3. Open Hushboard from Applications. macOS asks if you're sure you want to open an app downloaded from the internet. Click **Open**.
4. Hushboard opens a short welcome tour. When it ends, the panel opens under the keyboard icon in the menu bar. There's no Dock icon. You can replay the tour from the icon's right-click menu.

Then set up the keyboard helper from the panel (recommended, it makes the lock work everywhere):

5. Press **Install helper** and enter your Mac password.
6. When macOS asks, click **Open System Settings** and switch on **Hushboard Keyboard Helper** under Input Monitoring. The panel shows **Ready** by itself.

> Updating from 1.0.0 asks you to update the helper once and switch it on again, because it's now signed by Tekcify. After that, updates keep it switched on.

**Uninstall:** quit Hushboard from its panel, move it from Applications to the Bin, then remove the helper:

```bash
sudo "/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app/Contents/MacOS/hushboard-keyhelper" --keyhelper-uninstall
```

If you installed with Homebrew, `brew uninstall --cask hushboard` removes the app and the helper. Add `--zap` to remove your settings too.

## Windows 10 and 11

1. Download `Hushboard_<version>_x64-setup.exe` and run it.
2. If Windows shows "Windows protected your PC", click **More info**, then **Run anyway**.
3. The installer sets Hushboard up for your user account only, with no administrator rights needed. On Windows 10 it may download Microsoft WebView2 if it's missing.
4. Hushboard appears in the system tray. If you don't see it, click the **^** arrow next to the clock; you can drag the icon onto the taskbar to keep it visible.

Windows locks every keyboard at once. **Ctrl + Alt + Del** always works, as Windows intends.

**Uninstall:** Settings → Apps → Installed apps → Hushboard → Uninstall.

## Linux (x86-64)

Pick the package for your distribution:

| File | Install |
| --- | --- |
| `Hushboard_<version>_amd64.deb` (Ubuntu, Debian, Mint, Pop!_OS) | `sudo apt install ./Hushboard_<version>_amd64.deb` |
| `Hushboard-<version>-1.x86_64.rpm` (Fedora, openSUSE). Stable releases only; on a beta, use the AppImage | `sudo dnf install ./Hushboard-<version>-1.x86_64.rpm` |
| `Hushboard_<version>_amd64.AppImage` (any distribution) | `chmod +x Hushboard_*.AppImage`, then run it |

Hushboard needs read access to your keyboards. Add yourself to the `input` group once, then log out and back in:

```bash
sudo usermod -aG input $USER
```

> Members of the `input` group can read all keyboards and mice, so any program you run gets that access too. Only do this on a computer you trust. A more contained option is planned.

- **GNOME:** tray icons need the [AppIndicator extension](https://extensions.gnome.org/extension/615/appindicator-support/) (preinstalled on Ubuntu). Without it, use the Hushboard window.
- **Updates:** the AppImage updates itself. The `.deb` and `.rpm` packages tell you when there's a new version to download.

**Uninstall:** `sudo apt remove hushboard` or `sudo dnf remove hushboard`, or delete the AppImage. Optionally remove yourself from the group: `sudo gpasswd -d $USER input`.

## Check a download

```bash
shasum -a 256 Hushboard_*        # macOS
sha256sum Hushboard_*            # Linux
```

```powershell
Get-FileHash .\Hushboard_*.exe   # Windows PowerShell
```

The result should match the line for that file in `SHA256SUMS.txt`.
