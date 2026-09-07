import { createStorage, type Driver, type Storage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import vercelRuntimeCache from 'unstorage/drivers/vercel-runtime-cache'

/** SHA-pinned content is immutable, so it can be cached for a long time. */
const TTL = 60 * 60 * 24

/** Content refs move with their branches, so the pointer cache uses a short TTL. */
const REF_TTL = 60

/** Whether the Vercel Runtime Cache is available (i.e. running on Vercel). */
function cacheAvailable(): boolean {
  return !import.meta.dev && Boolean(process.env.VERCEL)
}

/**
 * Bump when content parser/plugin configuration, relevant parser dependencies, or cached derived
 * data changes. Keeping this explicit lets unrelated deployments reuse immutable content artifacts.
 */
export const CONTENT_PARSER_VERSION = 'v3'

/**
 * The driver behind comark's index, parsed bodies and artifacts, for every commit. One namespace
 * per parser version; `content.withRef(sha)` adds a per-commit namespace on top, so instances
 * pinned to different commits share this driver without reading each other's entries. Bumping
 * the parser version leaves every commit's entries behind at once.
 */
export function contentCacheDriver(): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: `content:${CONTENT_PARSER_VERSION}`,
    ttl: TTL,
  })
}

/** Per-SHA driver for non-content data. */
function shaCacheDriver(sha: string): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: `content:${CONTENT_PARSER_VERSION}:${sha}`,
    ttl: TTL,
  })
}

/**
 * Ad-hoc per-SHA storage for non-content data (commit history, RSS dates). Its own namespace: comark's
 * entries live under `contentCacheDriver()` with a `ref:` prefix, so `gh:...` keys never meet them.
 */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: shaCacheDriver(sha) })
}

/**
 * Shared driver backing the branch + content directory → content commit pointer
 * (`resolveContentSha` in `github.ts`), in its own namespace so every instance reads one pointer
 * instead of keeping its own timer.
 *
 * Vercel Runtime Cache is **regional**, not global (https://vercel.com/docs/caching/runtime-cache):
 * this assumes Functions run in a single region (no `regions` in `vercel.json`/`nuxt.config.ts`).
 * Multi-region would confine the webhook's forced refresh to its region — others self-heal on TTL,
 * so reach for a globally replicated store (e.g. Edge Config) only if that day comes.
 */
export function refCacheDriver(): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: 'content:refs',
    ttl: REF_TTL,
  })
}
