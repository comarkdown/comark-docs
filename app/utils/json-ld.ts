/**
 * Serialize a value for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` escapes nothing HTML-significant, so a `</script>` in a title or FAQ answer would close the
 * element early and the rest be parsed as markup; the `\u00xx` escapes keep the JSON identical to parsers.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}
