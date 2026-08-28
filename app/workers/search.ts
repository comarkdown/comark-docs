/**
 * Search worker: owns the browser-standalone `comark-content` instance (sqlite-wasm FTS5).
 *
 * Hydrated from the per-commit snapshot artifacts.
 */
import { comarkContent, readArtifact } from 'comark-content'
import sqliteWasm from 'comark-content/database/sqlite-wasm'
import sqliteFullTextSearch from 'comark-content/plugins/sqlite-full-text-search'
import { ofetch } from 'ofetch'
import { describeArtifact, indexedRows, isDebug, log, logger, setDebug, since } from './internal/search-logger'
import type { CacheArtifact, ComarkContent, SearchOptions, SearchResult } from 'comark-content'
import type { SqliteFullTextSearchMethods } from 'comark-content/plugins/sqlite-full-text-search'

type SearchInstance = ComarkContent & SqliteFullTextSearchMethods

let instance: SearchInstance | undefined

/**
 * The in-flight hydration.
 *
 * Ensures only one hydration runs at a time.
 */
let hydration: Promise<void> | undefined

/** Loads the database. No-op once ready; retries after a failure. */
export function warmupSearch(apiBase: string, origin: string, debug: boolean): Promise<void> {
  setDebug(debug)
  if (instance) {
    log('warmup ignored — already ready')
    return Promise.resolve()
  }
  hydration ||= loadDatabase(apiBase, origin).catch((error) => {
    hydration = undefined // clears the guard so the next warmup can retry
    throw error
  })
  return hydration
}

async function loadDatabase(apiBase: string, origin: string): Promise<void> {
  const started = performance.now()
  try {
    const fetchArtifact = async (path: string): Promise<CacheArtifact> => {
      const url = new URL(path, origin).href
      const fetchStarted = performance.now()
      try {
        const artifact = await ofetch<CacheArtifact>(url)
        if (isDebug()) {
          let contents: string
          try {
            contents = describeArtifact(await readArtifact(artifact))
          } catch (error) {
            contents = `undecodable: ${error instanceof Error ? error.message : String(error)}`
          }
          log(`fetched ${path} in ${since(fetchStarted)} — ${artifact?.size ?? 0} bytes, ${contents}`)
        }
        return artifact
      } catch (error) {
        log(`failed ${path} after ${since(fetchStarted)}`, error)
        throw error
      }
    }

    const database = sqliteWasm()
    const content = comarkContent({
      cache: {
        loadManifest: () => fetchArtifact(`${apiBase}/manifest.json`),
        loadSnapshot: (source: string) => fetchArtifact(`${apiBase}/snapshot/${source}.json`),
      },
      plugins: [sqliteFullTextSearch({ database })],
      logger,
    })

    await content.init()

    const indexStarted = performance.now()
    await content.search(['content'], '') // pulls the snapshot in and builds the FTS index
    log(`index built in ${since(indexStarted)} — ${await indexedRows(database, 'content')} row(s)`)

    instance = content
    log(`ready in ${since(started)}`)
  } catch (error) {
    log(`hydration failed after ${since(started)}`, error)
    throw error
  }
}

/** Empty until hydration lands. */
export async function searchContent(query: string, opts?: SearchOptions): Promise<SearchResult[]> {
  if (!instance) {
    log(`dropped query "${query}" — no instance yet`)
    return []
  }
  const queryStarted = performance.now()
  const results = await instance.search(['content'], query, {
    limit: 25,
    snippet: { columns: ['content'] },
    ...opts,
  })
  log(`query "${query}" -> ${results.length} result(s) in ${since(queryStarted)}`)
  return results
}
