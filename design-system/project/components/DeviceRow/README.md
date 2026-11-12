# DeviceRow

A list row for one connected keyboard with a switch saying whether it will be locked; rows stack inside `.hb-devices`.

**Markup:** `.hb-devices[role=group]` holding `button.hb-device[role=checkbox][aria-checked]`. Each row has `.hb-device__icon` (keyboard glyph), a name (`.hb-device__name`), a meta line (`.hb-device__meta`) and a decorative `.hb-switch` mirroring the row's `aria-checked`. The whole row is the hit target.

**Data the consumer provides:** device name as the OS reports it, connection type (Built-in, USB, Bluetooth), and whether the platform can lock it on its own.

**Defaults:** only the built-in keyboard is selected. External keyboards stay active, so a spare keyboard is a second way out.

**Platform note in the meta line:** where the platform can't lock devices one at a time (Windows low-level hooks and macOS event taps block *all* keyboards), show a single row "All keyboards" with the caption "This system locks every keyboard at once" instead of per-device switches. Don't show switches that do nothing.

Selected rows take `suds` with `on-suds` meta text; the icon tile turns `seal`.
