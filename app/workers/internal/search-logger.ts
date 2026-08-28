/**
 * Logging for the search worker.
 *
 * Triggered by `?debug=search` param.
 */
import type { ContentFile, Logger, RelationalDatabase } from 'comark-content'

const PREFIX = '[search:worker]'

let debug = false

/** Called on every `warmup`; once on, it stays on for the life of the worker. */
export function setDebug(value: boolean): void {
  debug = debug || value
}

export function isDebug(): boolean {
  return debug
}

export function log(...args: unknown[]): void {
  if (debug) console.info(PREFIX, ...args)
}

/** Milliseconds since `from`, for log lines. */
export function since(from: number): string {
  return `${(performance.now() - from).toFixed(1)}ms`
}

/**
 * Warn and error are deliberately ungated: the FTS plugin reports a missing snapshot through this
 * channel, and that failure is otherwise indistinguishable from "the query matched nothing".
 */
export const logger: Logger = {
  debug: (tag, ...args) => log(`${tag}:`, ...args),
  info: (tag, ...args) => log(`${tag}:`, ...args),
  warn: (tag, ...args) => console.warn(`${PREFIX} ${tag}:`, ...args),
  error: (tag, ...args) => console.error(`${PREFIX} ${tag}:`, ...args),
}

/**
 * What a decoded artifact holds: a snapshot decodes to the source's items, the manifest to an object
 * keyed by path. `with nodes` is the number that matters — the FTS plugin indexes
 * `kind === 'document' && nodes?.length`, so a bodies-less (partial) snapshot builds an empty index.
 */
export function describeArtifact(decoded: unknown): string {
  if (Array.isArray(decoded)) {
    const items = decoded as ContentFile[]
    const documents = items.filter((item) => item.meta.kind === 'document')
    const withNodes = documents.filter((item) => item.nodes?.length)
    return `${items.length} item(s), ${documents.length} document(s), ${withNodes.length} with nodes`
  }
  const items = (decoded as { items?: Record<string, unknown> } | null)?.items
  return `${items ? Object.keys(items).length : 0} manifest item(s)`
}

/**
 * Rows in the FTS plugin's index — the one number that separates "nothing was indexed" from "the
 * query found nothing", since `search()` catches SQL errors and returns `[]` either way. Reads the
 * plugin's private table, so it is a diagnostic, not something to build on.
 */
export async function indexedRows(database: RelationalDatabase, source: string): Promise<number | string> {
  try {
    const rows = await database.all<{ n: number }>('SELECT count(*) as n FROM __fts_search WHERE source = ?', [source])
    return rows?.[0]?.n ?? 'unknown'
  } catch (error) {
    return `unknown (${error instanceof Error ? error.message : String(error)})`
  }
}
