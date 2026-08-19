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
 * Runtime Cache persists across deployments within one Vercel environment. Include the deployment's
 * code revision so a parser/plugin change cannot restore artifacts produced by older code.
 */
export function contentCacheBase(sha: string): string {
  const deploymentRef = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID
  return deploymentRef ? `content:${deploymentRef}:${sha}` : `content:${sha}`
}

/** Per-deployment, per-content-SHA driver backing comark's manifest and parsed bodies. */
export function cacheDriver(sha: string): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({
    base: contentCacheBase(sha),
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
