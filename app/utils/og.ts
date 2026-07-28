/**
 * Helpers for the Satori OG template (`components/OgImage/OgImageDocs.satori.vue`).
 *
 * Satori implements a subset of CSS, so anything it can't evaluate has to be
 * computed here instead. Kept out of the SFC to be testable — the template renders
 * inside a nuxt-og-image island, which isn't reachable from a unit test.
 */

/**
 * Flatten a hex colour to `rgba()` at a given alpha.
 *
 * Satori has no `color-mix()`. Only `#rgb` / `#rrggbb` can be decomposed; anything
 * else (a named colour, `oklch()`) returns `transparent` rather than
 * `rgba(NaN, NaN, NaN, …)`, which Satori paints as an opaque black block.
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value
  if (!/^[0-9a-f]{6}$/i.test(full)) return 'transparent'
  const int = Number.parseInt(full, 16)
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, ${alpha})`
}

/** Truncate on a word boundary when there is one, with an ellipsis. */
export function truncate(str: string, max: number): string {
  if (!str || str.length <= max) return str
  const cut = str.lastIndexOf(' ', max)
  return `${str.slice(0, cut > 0 ? cut : max)}…`
}
