import { createStorage, type Driver, type Storage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import vercelRuntimeCache from 'unstorage/drivers/vercel-runtime-cache'

/** SHA-pinned content is immutable, so it can be cached for a long time. */
const TTL = 60 * 60 * 24

/** Branch tips move, so the ref pointer cache uses a short TTL. */
const REF_TTL = 60

/** Whether the Vercel Runtime Cache is available (i.e. running on Vercel). */
function cacheAvailable(): boolean {
  return !import.meta.dev && Boolean(process.env.VERCEL)
}

/** Per-SHA driver backing comark's content cache (parsed bodies). */
export function cacheDriver(sha: string): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: `cms:${sha}`,
    ttl: TTL,
  })
}

/**
 * Ad-hoc per-SHA storage for non-content data (commit history, RSS dates). Shares comark's
 * `cacheDriver(sha)` namespace rather than a separate unconfigured mount; `gh:...` keys can't
 * collide with comark's `<source>:<path>`.
 */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: cacheDriver(sha) })
}

/**
 * Shared driver backing the branch → commit SHA pointer (`resolveSha`/`cacheSha` in `github.ts`),
 * in its own namespace so every instance reads one pointer instead of keeping its own timer.
 *
 * Vercel Runtime Cache is **regional**, not global (https://vercel.com/docs/caching/runtime-cache):
 * this assumes Functions run in a single region (no `regions` in `vercel.json`/`nuxt.config.ts`).
 * Multi-region would confine `cacheSha()`'s write-through to the webhook's region — others self-heal
 * on TTL, so reach for a globally replicated store (e.g. Edge Config) only if that day comes.
 */
export function refCacheDriver(): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: 'cms:refs',
    ttl: REF_TTL,
  })
}
