/**
 * Serialize a value for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` alone is not safe here. It escapes nothing HTML-significant, so
 * a `</script>` anywhere in the value — a page title, a FAQ answer — closes the
 * script element early and the remainder is parsed as markup. Every value we embed
 * comes from repo content rather than visitor input, so this is a correctness guard
 * before it's a security one, but the fix is the same either way.
 *
 * `<` is the standard escape: JSON parsers decode it back to `<`, so the
 * structured data is unchanged, while the HTML parser never sees a tag.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}
