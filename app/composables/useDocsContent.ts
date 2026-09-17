import { createContentClient } from 'comark-content/client'
import type { ActiveContent, ContentMode } from '../types/content'
import { withLeadingSlash } from 'ufo'

export const prodContent = createContentClient({
  basePath: '/api/content',
  fetch: $fetch,
})

const clients = new Map<string, typeof prodContent>()

function getClient(basePath: string) {
  let client = clients.get(basePath)
  if (!client) {
    client = createContentClient({
      basePath,
      fetch: $fetch,
    })
    clients.set(basePath, client)
  }
  return client
}

/** Resolve the active content client for the current route (from the parsed `[...slug]`). */
export function useDocsContent(): ComputedRef<ActiveContent> {
  const route = useRoute()
  return computed<ActiveContent>(() => {
    const path = withLeadingSlash(
      Array.isArray(route.params.slug) ? route.params.slug.join('/') : (route.params.slug as string)
    )

    let mode: ContentMode = 'prod'
    let ref: string | undefined
    let routeBase = ''

    if (route.params.ref && route.path.startsWith('/tree/')) {
      mode = 'tree'
      ref = route.params.ref as string
      routeBase = `/tree/${encodeURIComponent(ref)}`
    } else if (route.params.ref && route.path.startsWith('/blob/')) {
      mode = 'blob'
      ref = route.params.ref as string
      routeBase = `/blob/${ref}`
    } else if (route.params.number && route.path.startsWith('/pr/')) {
      mode = 'pr'
      ref = route.params.number as string
      routeBase = `/pr/${ref}`
    }

    const apiBase = `/api/content${routeBase}`

    return {
      mode,
      ref,
      routeBase,
      path,
      client: mode === 'prod' ? prodContent : getClient(apiBase),
      apiBase
    }
  })
}
