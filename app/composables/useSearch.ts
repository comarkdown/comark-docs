import type { SearchOptions, SearchResult } from 'comark-content'
import type { SearchWorkerPayload, SearchWorkerResponse } from '../types/search-worker'

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error'

const status = ref<SearchStatus>('idle')

let worker: Worker | undefined
let nextId = 0
const pending = new Map<number, { resolve: (results: SearchResult[]) => void, reject: (error: Error) => void }>()

function getWorker(): Worker {
  if (worker) return worker

  worker = new Worker(new URL('../workers/search.worker.ts', import.meta.url), { type: 'module' })

  worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
    const message = event.data
    if (message.type === 'status') {
      status.value = message.value
      return
    }
    const settle = pending.get(message.id)
    if (!settle) return
    pending.delete(message.id)
    if (message.type === 'result') settle.resolve(message.results)
    else settle.reject(new Error(message.message))
  }

  worker.onerror = () => {
    status.value = 'error'
    for (const { reject } of pending.values()) reject(new Error('[search] the search worker failed to load'))
    pending.clear()
  }

  return worker
}

function request(message: SearchWorkerPayload): Promise<SearchResult[]> {
  const id = ++nextId
  return new Promise<SearchResult[]>((resolve, reject) => {
    pending.set(id, { resolve, reject })
    try {
      getWorker().postMessage({ ...message, id })
    } catch (error) {
      pending.delete(id)
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
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
   * Load the database ahead of the first keystroke. No-op once loading or ready; retries after a
   * failure — the worker holds that guard, since this side's `status` lags a message behind.
   */
  async function warmup(): Promise<void> {
    try {
      if (!headSha.value && !import.meta.dev) {
        throw new Error('[search] /api/content/head returned no commit pin')
      }

      // Immutable per-commit artifacts, CDN-cached forever. Only unpinned in dev, per the guard above.
      const apiBase = headSha.value ? `/api/content/blob/${headSha.value}` : '/api/content'

      await request({ type: 'warmup', apiBase, origin: location.origin })
    } catch (error) {
      status.value = 'error'
      console.error('[search] could not load the search database', error)
    }
  }

  if (import.meta.client) {
    onNuxtReady(warmup)
  }

  async function search(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
    return request({ type: 'search', query, opts })
  }

  return { search, status: readonly(status), warmup }
}
