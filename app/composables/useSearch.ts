import type { SearchOptions, SearchResult } from 'comark-content'

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

const status = ref<SearchStatus>('idle')

/**
 * Hydration logging switch: `?debug=search`
 */
function searchDebug(): boolean {
  if (!import.meta.client) return false
  return new URLSearchParams(location.search).get('debug') === 'search'
}

/**
 * Client-side full-text search over the active route's content (sqlite-wasm FTS5)
 * Hydrated from the per-commit snapshot artifacts.
 */
export function useSearch() {
  const content = useDocsContent()
  const sha = inject<Ref<string | null>>('sha', ref(null))

  /** What to hydrate from, or `null` when this route has nothing searchable. */
  const target = computed(() => {
    const isPreview = content.value.mode !== 'prod'
    if (sha.value) return {
      sha: sha.value,
      isPreview,
      apiBase: `/api/content/blob/${sha.value}`
    }

    // Prod in dev mode
    if (!isPreview && import.meta.dev) return {
      sha: null,
      isPreview,
      apiBase: '/api/content'
    }

    return null
  })

  const available = computed(() => target.value !== null)

  /**
   * Load the database for the current target.
   * No-ops if the target is unchanged.
   */
  async function warmup(): Promise<void> {
    const current = target.value

    if (!current) {
      if (content.value.mode === 'prod' && !import.meta.dev) {
        console.error('[search] prod route resolved no commit pin — search hidden')
      }
      return
    }

    status.value = 'loading'
    try {
      const debug = searchDebug()
      if (debug) console.info(`[search] warmup from ${current.apiBase} (sha ${current.sha ?? 'unpinned'})`)

      await warmupSearch({
        apiBase: current.apiBase,
        sha: current.sha,
        isPreview: current.isPreview,
        origin: location.origin,
        debug,
      })
      status.value = 'ready'
    } catch (error) {
      status.value = 'error'
      console.error('[search] could not load the search database', error)
    }
  }

  if (import.meta.client) {
    onNuxtReady(warmup)
    watch(() => target.value && `${target.value.isPreview}:${target.value.sha}`, warmup)
  }

  async function search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return prefixSearchResults(await searchContent(query, opts), content.value.routeBase)
  }

  return {
    search,
    status: readonly(status),
    warmup,
    available,
  }
}
