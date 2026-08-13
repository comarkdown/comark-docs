import type { CacheArtifact, RelationalDatabase, SearchOptions, SearchResult } from 'comark-content'
import type { ActiveContent } from './useDocsContent'
import { prefixLink } from '../utils/routing'

type LocalSearchStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The subset of the hydrated instance the palette needs (plugin methods, so typed by hand). */
interface LocalSearchInstance {
  init: () => Promise<void>
  search: (sources: string[], query: string, opts?: SearchOptions) => Promise<SearchResult[]>
}

const COMMIT_SHA = /^[0-9a-f]{40}$/i

type LocalSearchScope = 'prod' | 'preview'

/**
 * At most two databases ever exist, one per scope:
 * - prod: pinned to the head commit the page was rendered at (built once, kept for the session)
 * - preview: one at a time, keyed by `previewBase` — visiting another `/tree` or `/blob` ref
 *   rebuilds the instance but reuses the preview database (its FTS rows are cleared per source)
 */
let prodInstance: Promise<LocalSearchInstance> | undefined
let previewInstance: Promise<LocalSearchInstance> | undefined
let previewBase: string | undefined
let previewDatabase: RelationalDatabase | undefined
const status = ref<LocalSearchStatus>('idle')

function resolveApiBase(active: ActiveContent, headSha: string): string {
  if (active.mode === 'tree') return `/api/content/tree/${encodeURIComponent(active.ref!)}`
  if (active.mode === 'blob') return `/api/content/blob/${active.ref}`
  return COMMIT_SHA.test(headSha) ? `/api/content/blob/${headSha}` : '/api/content'
}

async function createInstance(apiBase: string, scope: LocalSearchScope): Promise<LocalSearchInstance> {
  // Dynamic imports so sqlite-wasm and the FTS plugin only ever load in the browser, on demand.
  const [{ comarkContent }, sqliteWasm, sqliteFullTextSearch] = await Promise.all([
    import('comark-content'),
    import('comark-content/database/sqlite-wasm').then((m) => m.default),
    import('comark-content/plugins/sqlite-full-text-search').then((m) => m.default),
  ])

  const database = scope === 'preview' ? (previewDatabase ??= sqliteWasm()) : sqliteWasm()
  const content = comarkContent({
    cache: {
      loadManifest: () => $fetch<CacheArtifact>(`${apiBase}/manifest.json`),
      loadSnapshot: (source: string) => $fetch<CacheArtifact>(`${apiBase}/snapshot/${source}.json`),
    },
    plugins: [sqliteFullTextSearch({ database })],
  }) as unknown as LocalSearchInstance

  // Warm up the instance
  await content.init()
  await content.search(['content'], '')

  return content
}

async function buildInstance(
  active: ActiveContent,
  headSha: string,
  scope: LocalSearchScope
): Promise<LocalSearchInstance> {
  status.value = 'loading'
  try {
    const content = await createInstance(resolveApiBase(active, headSha), scope)
    status.value = 'ready'
    return content
  } catch (error) {
    // Don't memoize a failed hydration — the next palette open should retry.
    if (scope === 'prod') {
      prodInstance = undefined
    } else if (previewBase === active.base) {
      previewInstance = undefined
      previewBase = undefined
    }
    status.value = 'error'
    throw error
  }
}

function getInstance(active: ActiveContent, headSha: string): Promise<LocalSearchInstance> {
  if (active.mode === 'prod') {
    prodInstance ??= buildInstance(active, headSha, 'prod')
    return prodInstance
  }

  if (!previewInstance || previewBase !== active.base) {
    previewBase = active.base
    previewInstance = buildInstance(active, headSha, 'preview')
  }
  return previewInstance
}

/**
 * Client-side full-text search: a browser-standalone comark-content instance (sqlite-wasm FTS5)
 * hydrated from the per-commit snapshot artifacts. BM25-ranked section results, zero server work
 * per keystroke. `status` follows `UContentSearch`'s `search-status` contract; a failed hydration
 * surfaces as `'error'` and the next palette open retries.
 */
export function useLocalSearch() {
  const active = useDocsContent()

  // The head commit the page was rendered at, resolved during SSR (in-process call) and shipped
  // in the payload — the client never refetches it. The pin can advance past the deploy SHA via
  // the push webhook, so it must come from the server's `getHeadRef()`, not build-time env.
  const { data: headSha } = useAsyncData(
    'content-head-sha',
    () => $fetch<{ sha: string }>('/api/content/head').then(({ sha }) => sha),
    { default: () => '' }
  )

  /** Kick off wasm + snapshot loading before the first keystroke needs it. */
  function warmup(): void {
    getInstance(active.value, headSha.value).catch(() => {}) // surfaced through `status`
  }

  if (import.meta.client) {
    onNuxtReady(warmup)
  }

  async function search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    const instance = await getInstance(active.value, headSha.value)
    const results = await instance.search(['content'], query, {
      limit: 25,
      snippet: { columns: ['content'] },
      ...opts,
    })

    // Preview modes: keep result links inside `/tree/<ref>` / `/blob/<ref>`, like `searchFiles`.
    const base = active.value.base
    if (!base) return results
    return results.map((result) => {
      const [path, hash] = result.id.split('#')
      return { ...result, id: prefixLink(path!, base) + (hash ? `#${hash}` : '') }
    })
  }

  return { search, status: readonly(status), warmup }
}
