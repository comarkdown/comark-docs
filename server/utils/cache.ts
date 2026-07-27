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
 * Ad-hoc per-SHA storage for auxiliary data that isn't a comark content item —
 * e.g. GitHub commit-history (`history.get.ts`) and RSS date lookups
 * (`rss.xml.get.ts`). Backed by the same `cacheDriver(sha)` Runtime Cache
 * namespace comark's own content cache uses (keys are prefixed distinctly —
 * `gh:...` vs comark's `<source>:<path>` — so there's no collision), rather
 * than a separate unconfigured storage mount.
 */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: cacheDriver(sha) })
}

/**
 * Shared driver backing the branch → commit SHA pointer (see `resolveSha`/`cacheSha`
 * in `github.ts`). Separate namespace from the per-SHA content driver above: every
 * instance reads the same pointer instead of maintaining its own timer, so only one
 * GitHub API call happens per TTL window.
 *
 * Vercel Runtime Cache is **regional** (each region has its own cache — see
 * https://vercel.com/docs/caching/runtime-cache), not globally shared. This design
 * assumes this project runs its Functions in a single region (no `regions` array in
 * `vercel.json`/`nuxt.config.ts`), so that assumption currently holds. If this project
 * ever goes multi-region, `cacheSha()`'s write-through only reaches the region that
 * ran the webhook — other regions would fall back to their own `resolveSha()` TTL
 * (still correct, just no longer near-instant everywhere). Reach for a globally
 * replicated store (e.g. Vercel Edge Config) instead if that becomes a real need.
 */
export function refCacheDriver(): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: 'cms:refs',
    ttl: REF_TTL,
  })
}
