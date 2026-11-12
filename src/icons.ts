// Hugeicons (free set, MIT) from the design system's Icons group, inlined so they take
// `currentColor`.
const files = import.meta.glob("../design-system/project/assets/Icons/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const byName = new Map(
  Object.entries(files).map(([path, svg]) => [path.split("/").pop()!.replace(/\.svg$/, ""), svg]),
);

export type IconName =
  | "square-lock-02"
  | "square-unlock-02"
  | "keyboard"
  | "keyboard-off"
  | "laptop"
  | "usb"
  | "bluetooth"
  | "timer-02"
  | "cursor-hold-01"
  | "touchpad-01"
  | "shield-check"
  | "shield-alert"
  | "alert-02"
  | "information-circle"
  | "settings-02"
  | "circle-arrow-reload-01"
  | "cancel-01"
  | "tick-02"
  | "sparkles"
  | "brush-cleaning"
  | "moon-02"
  | "volume-high"
  | "login-03"
  | "apple"
  | "windows-new";

/** Inline SVG markup for an icon, hidden from screen readers (labels carry the meaning). */
export function icon(name: IconName): string {
  const svg = byName.get(name);
  if (!svg) throw new Error(`Missing icon ${name}`);
  return svg.replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
}
