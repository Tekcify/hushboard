# PermissionCard

A card that explains one OS permission the lock needs, shows whether it is granted, and links to where to grant it.

**Markup:** `.hb-perm` (add `--blocked` or `--granted`) with `.hb-perm__icon` and `.hb-perm__body` holding `__title` (with a StatusPill), `__text`, and an optional row of Buttons.

**Variants:**
- `--blocked`: `danger` border and icon, a primary button that opens the exact settings pane, plus a ghost "Check again".
- `--granted`: `suds` icon tile, no buttons.
- Plain: an informational caveat (Wayland, a remote desktop session, a virtual machine).

**Copy per platform:**
- macOS: "Accessibility access" and "Input Monitoring". Name the full path: System Settings → Privacy & Security → Accessibility.
- Windows: no permission card. Show one caveat only if the app is not elevated and a window that is ("Task Manager") has focus: "Windows won't let Hushboard block keys while an admin window is in front."
- Linux: "Input device access" (the `input` group or a polkit prompt). On X11 no card is needed.

Always say what the permission is used for and that nothing is recorded. Never word it as a scare ("Your Mac is not protected").
