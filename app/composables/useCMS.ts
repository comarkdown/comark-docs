import { createCMSClient } from '@comark/cms/client'
import { searchSectionsClient } from '../utils/search-sections'
import type { CMSMode } from '../types/cms'
import { withLeadingSlash } from 'ufo'

export const prodCMS = createCMSClient({
  basePath: '/api/cms',
  fetch: $fetch,
  plugins: [searchSectionsClient()],
})

const clients = new Map<string, ReturnType<typeof createCMSClient>>()

function getClient(basePath: string) {
  let client = clients.get(basePath)
  if (!client) {
    client = createCMSClient({
      basePath,
      fetch: $fetch,
      plugins: [searchSectionsClient()],
    })
    clients.set(basePath, client)
  }
  return client
}

export interface ActiveCMS {
  mode: CMSMode
  /** The branch name (tree) or commit SHA (blob); `undefined` in prod. */
  ref?: string
  /** Link prefix for this version (`/tree/<branch>`, `/blob/<sha>`, or `''` in prod). */
  base: string
  /** The path within the CMS content (with leading slash). */
  path: string
  client: typeof prodCMS
}

/** Resolve the active CMS for the current route (from the parsed `[...slug]`). */
export function useCMS(): ComputedRef<ActiveCMS> {
  const route = useRoute()
  return computed<ActiveCMS>(() => {
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
        client: getClient(`/api/cms/tree/${encodedRef}`),
      }
    }
    if (route.params.ref && route.path.startsWith('/blob/')) {
      return {
        mode: 'blob',
        ref: route.params.ref as string,
        base: `/blob/${route.params.ref}`,
        path,
        client: getClient(`/api/cms/blob/${route.params.ref}`),
      }
    }
    return { mode: 'prod', base: '', path, client: prodCMS }
  })
}
