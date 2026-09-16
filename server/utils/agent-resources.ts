import { withLeadingSlash } from 'ufo'

/** URI prefix of the MCP resource that serves a documentation page. */
export const PAGE_RESOURCE_PREFIX = 'docs://page'

/** `/getting-started/installation` -> `docs://page/getting-started/installation` */
export function pageResourceUri(route: string): string {
  return `${PAGE_RESOURCE_PREFIX}${withLeadingSlash(route)}`
}

/** The page route a resource URI names, or `null` when the URI is not a page resource. */
export function pageRouteFromUri(uri: string | URL): string | null {
  const href = typeof uri === 'string' ? uri : uri.href
  if (!href.startsWith(`${PAGE_RESOURCE_PREFIX}/`)) return null
  const route = href.slice(PAGE_RESOURCE_PREFIX.length).replace(/[?#].*$/, '')
  return route === '/' ? null : route
}
