/**
 * Serialize a value for a `<script type="application/ld+json">` body.
 *
 * `JSON.stringify` escapes nothing HTML-significant, so a `</script>` in a title or FAQ answer would close the
 * element early and the rest be parsed as markup; the `\u00xx` escapes keep the JSON identical to parsers.
 */
export function jsonLd(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}

export interface BreadcrumbListEntry {
  name: string
  /** Absolute URL. Required by Google for every BreadcrumbList ListItem. */
  item: string
}

/**
 * Build a schema.org BreadcrumbList. Every entry must carry an absolute `item` URL — Google rejects
 * crumbs that only have a name (e.g. non-page section nodes in the docs nav).
 */
export function breadcrumbListLd(entries: BreadcrumbListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: entries.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: entry.item,
    })),
  }
}
