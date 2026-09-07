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
 * The driver behind everything cached per parser version, under `content:<version>`:
 *
 * - without `sha`, comark's index, parsed bodies and artifacts for every commit. An instance pinned
 *   with `content.withRef(sha)` adds its own `ref:<sha>:` prefix, so instances pinned to different
 *   commits share this driver without reading each other's entries;
 * - with `sha`, ad-hoc per-commit data (commit history, RSS dates) under `content:<version>:<sha>`.
 *   Those keys start with `gh:` and never meet comark's.
 *
 * Bumping the parser version leaves every commit's entries behind at once.
 */
export function contentCacheDriver(sha?: string): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: sha ? `content:${CONTENT_PARSER_VERSION}:${sha}` : `content:${CONTENT_PARSER_VERSION}`,
    ttl: TTL,
  })
}

/** Ad-hoc per-SHA storage for non-content data (commit history, RSS dates). */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: contentCacheDriver(sha) })
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
