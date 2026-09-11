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
 * Client-side full-text search over production content (sqlite-wasm FTS5) hydrated from the
 * per-commit snapshot artifacts.
 */
export function useSearch() {
  const { data: headSha } = useAsyncData(
    'content-head-sha',
    () => $fetch<{ sha: string | null }>('/api/content/head').then(({ sha }) => sha),
    { default: () => null }
  )

  /**
   * Load the database.
   * No-op once loading or ready; retries after a failure.
   */
  async function warmup(): Promise<void> {
    if (status.value === 'loading' || status.value === 'ready') return
    status.value = 'loading'
    try {
      if (!headSha.value && !import.meta.dev) {
        throw new Error('[search] /api/content/head returned no commit pin')
      }

      // Immutable per-commit artifacts, CDN-cached forever. Only unpinned in dev, per the guard above.
      const apiBase = headSha.value ? `/api/content/blob/${headSha.value}` : '/api/content'

      const debug = searchDebug()
      if (debug) console.info(`[search] warmup from ${apiBase} (head ${headSha.value ?? 'unpinned'})`)

      await warmupSearch(apiBase, location.origin, debug)
      status.value = 'ready'
    } catch (error) {
      status.value = 'error'
      console.error('[search] could not load the search database', error)
    }
  }

  if (import.meta.client) {
    onNuxtReady(warmup)
  }

  async function search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return searchContent(query, opts)
  }

  return { search, status: readonly(status), warmup }
}
