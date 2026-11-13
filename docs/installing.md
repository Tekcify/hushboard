# Installing Hushboard

Download the file for your system from the [latest release](https://github.com/tekcify/hushboard/releases). Each release lists a `SHA256SUMS.txt` to check your download against.

> **Hushboard isn't signed by Apple or Microsoft yet.** Your system will warn you the first time you open Hushboard. The steps below get past that safely. Signed builds are planned. Once Hushboard is installed, it updates itself, and updates are signed by the Hushboard team and checked before installing.

## macOS (11 Big Sur or later, Apple Silicon or Intel)

1. Download `Hushboard_<version>_universal.dmg` and open it.
2. Drag **Hushboard** into **Applications**.
3. Open Hushboard from Applications. macOS says it "can't be opened because Apple cannot check it for malicious software". Click **Done** (not Move to Bin).
4. Open **System Settings → Privacy & Security**, scroll down to the message about Hushboard, and click **Open Anyway**. Confirm with your password or Touch ID.
5. Hushboard opens a short welcome tour. When it ends, the panel opens under the keyboard icon in the menu bar. There's no Dock icon. You can replay the tour from the icon's right-click menu.

Then set up the keyboard helper from the panel (recommended, it makes the lock work everywhere):

6. Press **Install helper** and enter your Mac password.
7. When macOS asks, click **Open System Settings** and switch on **Hushboard Keyboard Helper** under Input Monitoring. The panel shows **Ready** by itself.

> **Until builds are signed,** macOS may ask you to switch the helper on again after an update.

**Uninstall:** quit Hushboard from its panel, move it from Applications to the Bin, then remove the helper:

```bash
sudo "/Library/PrivilegedHelperTools/Hushboard Keyboard Helper.app/Contents/MacOS/hushboard-keyhelper" --keyhelper-uninstall
```

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
