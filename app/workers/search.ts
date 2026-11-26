/**
 * Search worker: serves one browser-standalone `comark-content` instance (sqlite-wasm FTS5) to `useSearch()`.
 *
 * Hydrated from one commit's snapshot artifacts: `useSearch()` starts one worker per commit.
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

// Set by `useSearch()` through the Worker's `name`.
const { sha, debug } = JSON.parse(self.name) as SearchWorkerInit
setDebug(debug)

const apiBase = sha ? `/api/content/blob/${sha}` : '/api/content'

serveContentWorker(comarkContent({
  source: snapshot(`${apiBase}/snapshot/${DEFAULT_CONTENT_NAME}.json`, `${apiBase}/manifest.json`),
  plugins: [sqliteFullTextSearch({ database: sqliteWasm() })],
  logger,
}))
