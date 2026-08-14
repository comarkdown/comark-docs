import type { SearchOptions, SearchResult } from 'comark-content'

/**
 * Protocol between `useSearch` and `app/workers/search.worker.ts`.
 *
 * Every request carries an `id` and gets exactly one `result`/`error` reply — `warmup` answers
 * with an empty array — so the caller can drain its pending map uniformly.
 */
export type SearchWorkerPayload =
  | {
    type: 'warmup'
    apiBase: string
    origin: string
  }
  | {
    type: 'search',
    query: string,
    opts?: SearchOptions
  }

/**
 * Intersected rather than spread into each member: `Omit<Union, 'id'>` would collapse to the
 * union's common keys, dropping every payload field.
 */
export type SearchWorkerRequest = SearchWorkerPayload & { id: number }

/** `status` arrives unsolicited: the worker owns the hydration lifecycle, the caller mirrors it. */
export type SearchWorkerResponse =
  | { type: 'status', value: 'loading' | 'ready' | 'error' }
  | { type: 'result', id: number, results: SearchResult[] }
  | { type: 'error', id: number, message: string }
