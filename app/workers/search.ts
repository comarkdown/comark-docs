/**
 * Search worker: serves one browser-standalone `comark-content` instance (sqlite-wasm FTS5) to `useSearch()`.
 *
 * Hydrated from one commit's snapshot artifacts.
 * Each `init()` from `useSearch()` swaps in another commit's instance; the worker cleans the previous one's rows.
 */
import { comarkContent, DEFAULT_CONTENT_NAME } from 'comark-content/runtime'
import sqliteWasm from 'comark-content/database/sqlite-wasm'
import snapshot from 'comark-content/sources/snapshot'
import sqliteFullTextSearch from 'comark-content/plugins/sqlite-full-text-search'
import { serveContentWorker } from 'comark-content/worker'
import { logger, setDebug } from './internal/search-logger'

export interface SearchWorkerInit {
  /** Commit the artifacts are pinned to, `null` for the unpinned dev content. */
  sha: string | null
  debug: boolean
}

// Shared database for the worker's lifetime
const database = sqliteWasm()

serveContentWorker(({ sha, debug }: SearchWorkerInit) => {
  setDebug(debug)
  const apiBase = sha ? `/api/content/blob/${sha}` : '/api/content'
  const content = comarkContent({
    source: snapshot(`${apiBase}/snapshot/${DEFAULT_CONTENT_NAME}.json`, `${apiBase}/manifest.json`),
    plugins: [sqliteFullTextSearch({ database })],
    logger,
  })
  return sha ? content.withRef(sha) : content
})
