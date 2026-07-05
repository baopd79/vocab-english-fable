/** Join class names, dropping falsy values. Tiny local alternative to clsx —
 * enough for our controlled variant maps (no Tailwind-merge conflict resolution). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
