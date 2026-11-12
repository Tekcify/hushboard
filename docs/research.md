# Hushboard: prior art and platform notes

Working name: **Hushboard**. It's a placeholder, so change it whenever you like.

## Existing open-source projects to study

Licences and maintenance were not checked for every repo. Look at the LICENSE file before you borrow code.

### macOS
| Project | What to look at |
| --- | --- |
| [kfv/keylock](https://github.com/kfv/keylock) | Minimal event-tap lock, MIT. Unlock combo is hard-coded (Ctrl + U). A good small reference for `CGEventTap`. |
| [gltchitm/keyboard-cleaner](https://github.com/gltchitm/keyboard-cleaner) | Disables input for a short period, MIT. |
| [adhamhaithameid/KeepClean](https://github.com/adhamhaithameid/KeepClean) ([site](https://adhamhaithameid.github.io/KeepClean/)) | macOS 13+. Locks keyboard and trackpad, with a guided Accessibility + Input Monitoring setup screen. Good onboarding reference. |
| [jsoyer/Wipey](https://github.com/jsoyer/Wipey) | Event-tap lock plus screen blackout, MIT, on Homebrew. |
| [eliseomartelli/cleeb](https://github.com/eliseomartelli/cleeb) | Small keyboard-cleaning app, MIT. |
| [eliophan/KeyboardClean](https://github.com/eliophan/KeyboardClean) | CLI (`keyboard-clean 60`), timer-based auto-unlock. |
| [mabyko/KeyPause](https://github.com/mabyko/KeyPause) | Another event-tap pause tool. |
| [Mac Pause write-up (DEV)](https://dev.to/_itsglover/i-built-a-mac-app-that-does-one-thing-let-you-clean-your-keyboard-181g), [CleanKeys (HN)](https://news.ycombinator.com/item?id=45808810) | Author write-ups and comments that cover real user worries. |
| KeyboardCleanTool ([Homebrew cask](https://formulae.brew.sh/cask/keyboardcleantool)) | Closed source, but it's the UX everyone compares against. |

### Windows
| Project | What to look at |
| --- | --- |
| [Axorax/keylock](https://github.com/Axorax/keylock) ([r/windows thread](https://www.reddit.com/r/windows/comments/1g7vk2r/)) | Locks keyboard and mouse. Commenters point out that it blocks *every* keyboard, not just the laptop's. |
| [takuyakanbr/padlock](https://github.com/takuyakanbr/padlock) | Keyboard + mouse locker. |
| [Keyboard Blocker (SourceForge)](https://sourceforge.net/projects/keyboard-blocker/) | Plain `WH_KEYBOARD_LL` hook that drops everything. |
| [Kkthnx/ZeroInput](https://github.com/Kkthnx/ZeroInput) | Blocks selected keys/combos with `WH_KEYBOARD_LL`. Useful for the escape-combo logic. |

### Cross-platform
| Project | What to look at |
| --- | --- |
| [gunchev/keyclean](https://github.com/gunchev/keyclean) | Locks the keyboard and draws a full ISO 105-key layout lighting up presses. That's the same idea as our Keycap "swallowed" state. |
| [faithvoid/keyboardcleaner](https://github.com/faithvoid/keyboardcleaner) | Locks until you close it. |
| [volkanncicek/input-lock](https://github.com/volkanncicek/input-lock) | Desktop app, keyboard + mouse. |
| [RhinoInani/pristine_screen](https://github.com/RhinoInani/pristine_screen) | Flutter, very small, no licence listed. |
| [keytap crate (docs.rs)](https://docs.rs/crate/keytap/0.4.0) | Rust crate with macOS tap and Windows hook sources. Worth reading if we go with Tauri/Rust. |

Listings: [AlternativeTo: Keyboard Cleaner](https://alternativeto.net/software/keyboard-cleaner).

## How locking works on each OS

| OS | Mechanism | Needs | Caveats |
| --- | --- | --- | --- |
| macOS | `CGEventTapCreate` on `kCGHIDEventTap` / session tap for keyDown, keyUp, flagsChanged and `NX_SYSDEFINED` (media keys); return `NULL` to drop | Accessibility (and Input Monitoring on recent macOS) | Blocks **all** keyboards. Power / Touch ID button can't be blocked. If the tap times out, macOS disables it, so re-enable on `kCGEventTapDisabledByTimeout`. |
| Windows | `SetWindowsHookEx(WH_KEYBOARD_LL)`; return `1` to swallow | Nothing; run elevated to also block over admin windows | Blocks all keyboards. Ctrl + Alt + Del and Win + L are handled by the OS and can't be blocked (that's a safety net). The hook callback must return fast or Windows drops it. ([Microsoft docs](https://learn.microsoft.com/en-us/windows/win32/winmsg/lowlevelkeyboardproc)) |
| Linux | `ioctl(fd, EVIOCGRAB, 1)` on `/dev/input/event*` keyboard devices (python-evdev: `device.grab()`). Fallback on X11: `xinput disable <id>` | Read access to `/dev/input` (the `input` group or polkit/udev rule) | Works on X11 **and** Wayland, and can target the built-in keyboard only. `xinput` / `xtrlock` only work on X11 ([ostechnix](https://ostechnix.com/lock-keyboard-mouse-not-screen-linux/), [Baeldung](https://www.baeldung.com/linux/internal-keyboard-disable)). |

Because a grab or hook still *sees* each key before dropping it, all three can detect the escape combo (Ctrl + Alt + U) while locked.

## Proposed stack

**Tauri 2 (Rust core + web UI).** The UI is HTML/CSS, so the design system's `bundle.css` and tokens drop straight in. Native keyboard code lives in one small Rust module per OS (`core-graphics` for the macOS tap, `windows` crate for the hook, `evdev` crate on Linux). The installer is a few MB instead of Electron's ~100 MB.

## Safety rules (built into the design system)

1. 3 s arming delay before the lock starts, cancellable.
2. Pointer is never locked. Unlock = hold the button for 1.5 s.
3. Escape shortcut Ctrl + Alt + U always works.
4. Default auto-unlock after 2 min; max 10 min.
5. Watchdog: if the UI process dies, the native hook is released.
6. Nothing typed is stored or sent anywhere.
