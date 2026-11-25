import { createContentClient } from 'comark-content/client'
import searchClient from 'comark-content/plugins/sqlite-full-text-search/client'
import { connectContentWorker } from 'comark-content/worker'
import type { SearchOptions, SearchResult } from 'comark-content'
import type { SearchWorkerInit } from '../workers/search'

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

const status = ref<SearchStatus>('idle')

/** One worker for the page: each commit (first one included) is an `init()` on it. */
let worker: ReturnType<typeof connect> | undefined
/** Commit the worker serves (or is loading) and its index build */
let loaded: { key: string, indexed: Promise<void> } | undefined

function connect() {
  const connection = connectContentWorker(new Worker(new URL('../workers/search.ts', import.meta.url), { type: 'module' }))
  return { connection, client: createContentClient({ fetch: connection.fetch, plugins: [searchClient()] }) }
}

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
  const sha = inject<Ref<string | null | undefined>>('sha', ref(null))

  /** What to hydrate from, or `null` when this route has nothing searchable (yet). */
  const target = computed(() => {
    const isPreview = content.value.mode !== 'prod'
    if (sha.value) return { sha: sha.value }
    // Prod in dev mode
    if (!isPreview && import.meta.dev) return { sha: null }
    return null
  })

  /**
   * Load the database for the current target.
   * No-ops if the target is unchanged.
   */
  async function warmup(): Promise<void> {
    // Not resolved yet — the `watch` below re-runs this once `sha` lands.
    if (sha.value === undefined) return

    const current = target.value

    if (!current) {
      if (content.value.mode === 'prod' && !import.meta.dev) {
        console.error('[search] prod route resolved no commit pin — search hidden')
      }
      return
    }

    const key = current.sha ?? 'unpinned' // dev mode only
    const debug = searchDebug()
    if (loaded?.key !== key) {
      if (debug) console.info(`[search] loading sha ${key}`)
      const init: SearchWorkerInit = { sha: current.sha, debug }
      worker ??= connect()
      const { connection, client } = worker
      loaded = { key, indexed: connection.init(init).then(() => client.buildSearchIndex()) }
    }
    const entry = loaded

    status.value = 'loading'
    const started = performance.now()
    try {
      await entry.indexed
      if (loaded !== entry) return // a switch occurred
      status.value = 'ready'
      if (debug) console.info(`[search] ready in ${(performance.now() - started).toFixed(1)}ms`)
    } catch (error) {
      if (loaded !== entry) return
      // A fresh worker on the next warmup: the connection may be failed for good.
      worker?.connection.terminate()
      worker = loaded = undefined
      status.value = 'error'
      console.error('[search] could not load the search database', error)
    }
  }

  if (import.meta.client) {
    onNuxtReady(warmup)
    watch(() => target.value && (target.value.sha ?? 'unpinned'), warmup)
  }

  async function search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    if (!worker) return []
    const results = await worker.client.search(query, { limit: 25, snippet: { columns: ['content'] }, ...opts })
    return prefixSearchResults(results, content.value.routeBase)
  }

  return {
    search,
    status: readonly(status),
    warmup,
  }
}
