// Nucleo Glass icons (free set, used under the Nucleo license, not MIT: see
// design-system/project/assets/IconsGlass/README.md), inlined so CSS can tint them.
//
// Each icon is layered glass: a solid back shape, a frosted front and a light edge, drawn with
// gradients that read CSS custom properties (--nc-gradient-1-color-1/2 for the back,
// --nc-gradient-2-color-1/2 for the glass, --nc-light for the edge). app.css sets them per theme
// and per place (clay where something is locked or ready).
const files = import.meta.glob("../design-system/project/assets/IconsGlass/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const byFile = new Map(
  Object.entries(files).map(([path, svg]) => [
    path.split("/").pop()!.replace(/\.svg$/, ""),
    svg.replace(/^<!--[\s\S]*?-->\s*/, ""), // the licence notice stays in the file, not the page
  ]),
);

/** What the app asks for, and the Glass icon that draws it. */
const GLASS = {
  "square-lock-02": "Lock",
  "square-unlock-02": "Key",
  keyboard: "Keyboard",
  laptop: "Laptop",
  usb: "Connect",
  bluetooth: "Signal",
  "shield-check": "CircleCheck",
  "shield-alert": "TriangleWarning",
  "alert-02": "TriangleWarning",
  "circle-arrow-reload-01": "Refresh",
  "cancel-01": "DeleteX",
  "tick-02": "CircleCheck",
  sparkles: "Sparkle",
  "brush-cleaning": "Feather", // the brand mark: a feather duster, for cleaning
  "moon-02": "EyeClosed", // "Cover the screen"
  "login-03": "Bolt", // "Open at login"
} as const;

export type IconName = keyof typeof GLASS;

let uses = 0;

/** Inline SVG markup for an icon, hidden from screen readers (labels carry the meaning). Each
 *  call gets its own gradient, mask and filter ids, so copies on one page don't share them. */
export function icon(name: IconName): string {
  const svg = byFile.get(GLASS[name]);
  if (!svg) throw new Error(`Missing icon ${name} (${GLASS[name]})`);
  const uid = `hb${(uses++).toString(36)}-`;
  return svg
    .replaceAll("__UID__", uid)
    .replace("<svg ", '<svg class="hb-glass" aria-hidden="true" focusable="false" ');
}
