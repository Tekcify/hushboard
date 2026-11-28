// Joins class names, skipping empty ones. Enough for our components without pulling in clsx.
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}
