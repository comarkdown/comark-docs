import { createContentClient } from 'comark-content/client'
import { searchSectionsClient } from '../utils/search-sections'
import type { ContentMode } from '../types/content'
import { withLeadingSlash } from 'ufo'

export const prodContent = createContentClient({
  basePath: '/api/content',
  fetch: $fetch,
  plugins: [searchSectionsClient()],
})

const clients = new Map<string, typeof prodContent>()

function getClient(basePath: string) {
  let client = clients.get(basePath)
  if (!client) {
    client = createContentClient({
      basePath,
      fetch: $fetch,
      plugins: [searchSectionsClient()],
    })
    clients.set(basePath, client)
  }
  return client
}

export interface ActiveContent {
  mode: ContentMode
  /** The branch name (tree), commit SHA (blob) or PR number (pr); `undefined` in prod. */
  ref?: string
  /** Link prefix for this version (`/tree/<branch>`, `/blob/<sha>`, `/pr/<number>`, or `''` in prod). */
  base: string
  /** The path within the content source (with leading slash). */
  path: string
  client: typeof prodContent
}

/** Resolve the active content client for the current route (from the parsed `[...slug]`). */
export function useDocsContent(): ComputedRef<ActiveContent> {
  const route = useRoute()
  return computed<ActiveContent>(() => {
    const path = withLeadingSlash(
      Array.isArray(route.params.slug) ? route.params.slug.join('/') : (route.params.slug as string)
    )
    if (route.params.ref && route.path.startsWith('/tree/')) {
      const encodedRef = encodeURIComponent(route.params.ref as string)
      return {
        mode: 'tree',
        ref: route.params.ref as string,
        base: `/tree/${encodedRef}`,
        path,
        client: getClient(`/api/content/tree/${encodedRef}`),
      }
    }
    if (route.params.ref && route.path.startsWith('/blob/')) {
      return {
        mode: 'blob',
        ref: route.params.ref as string,
        base: `/blob/${route.params.ref}`,
        path,
        client: getClient(`/api/content/blob/${route.params.ref}`),
      }
    }
    if (route.params.number && route.path.startsWith('/pr/')) {
      return {
        mode: 'pr',
        ref: route.params.number as string,
        base: `/pr/${route.params.number}`,
        path,
        client: getClient(`/api/content/pr/${route.params.number}`),
      }
    }
    return { mode: 'prod', base: '', path, client: prodContent }
  })
}
