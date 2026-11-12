// Turns the design system's tokens.json into CSS custom properties at startup, so the app and
// the design system can never drift apart. Mirrors the layout of the system's tokens.css, plus
// a prefers-color-scheme block so the app follows the OS theme.
import tokens from "../design-system/project/tokens.json";

type Themed = string | Record<string, string>;
interface Entry {
  name: string;
  value: Themed;
}
interface Family {
  tokens: Entry[];
}

// Fontsource's variable packages register these family names.
const FONT_ALIASES: Record<string, string> = {
  display: '"Bricolage Grotesque Variable", ',
  sans: '"Instrument Sans Variable", ',
  mono: "",
};

const themes = tokens.color.themes.map((t) => t.id);
const first = themes[0];

function resolve(v: string): string {
  const alias = /^\{(.+)\}$/.exec(v);
  return alias ? `var(--${alias[1]})` : v;
}

function valueFor(e: Entry, theme: string): string {
  if (typeof e.value === "string") return resolve(e.value);
  return resolve(e.value[theme] ?? e.value[first]);
}

function declarations(entries: Entry[], theme: string): string {
  return entries.map((e) => `  --${e.name}: ${valueFor(e, theme)};`).join("\n");
}

export function tokensCss(): string {
  const themed: Entry[] = [...(tokens.color.tokens as Entry[]), ...(tokens.shadow.tokens as Entry[])];
  const plain: Entry[] = [
    ...(tokens.spacing as Family).tokens,
    ...(tokens.radius as Family).tokens,
    ...(tokens.timing as Family).tokens,
  ];
  const families = Object.entries(tokens.type.families)
    .map(([k, stack]) => `  --font-${k}: ${FONT_ALIASES[k] ?? ""}${stack};`)
    .join("\n");

  const styles = tokens.type.groups
    .flatMap((g) =>
      g.styles.map((s) => {
        const fam = (s as { family?: string }).family ?? g.family;
        const ls = (s as { letterSpacing?: string }).letterSpacing;
        return `.${s.name} { font-family: var(--font-${fam}); font-size: ${s.fontSize}; line-height: ${s.lineHeight}; font-weight: ${s.fontWeight};${ls ? ` letter-spacing: ${ls};` : ""} }`;
      }),
    )
    .join("\n");

  const dark = themes.find((t) => t === "dark");
  return [
    `:root, [data-theme="${first}"] {\n${declarations(themed, first)}\n}`,
    ...themes
      .filter((t) => t !== first)
      .map((t) => `[data-theme="${t}"] {\n${declarations(themed, t)}\n  color-scheme: dark;\n}`),
    dark
      ? `@media (prefers-color-scheme: dark) {\n:root:not([data-theme="${first}"]) {\n${declarations(themed, dark)}\n  color-scheme: dark;\n}\n}`
      : "",
    `:root {\n${declarations(plain, first)}\n${families}\n}`,
    styles,
  ].join("\n\n");
}

export function installTokens(): void {
  const style = document.createElement("style");
  style.dataset.source = "design-system/project/tokens.json";
  style.textContent = tokensCss();
  document.head.prepend(style);
}

/** A timing token in milliseconds ("3s" → 3000, "1500ms" → 1500). */
export function timingMs(name: string): number {
  const entry = (tokens.timing as Family).tokens.find((t) => t.name === name);
  if (!entry || typeof entry.value !== "string") throw new Error(`Unknown timing token ${name}`);
  const v = entry.value.trim();
  return v.endsWith("ms") ? parseFloat(v) : parseFloat(v) * 1000;
}
