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

/** Every namespace below degrades to per-process memory off Vercel if not available. */
function runtimeCacheDriver(base: string, ttl: number): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({ base, ttl })
}

/**
 * Bump when content parser/plugin configuration, relevant parser dependencies, or cached derived
 * data changes. Keeping this explicit lets unrelated deployments reuse immutable content artifacts.
 */
export const CONTENT_PARSER_VERSION = 'v3'

/**
 * Comark cache: index, parsed bodies and artifacts of every commit.
 * Sharing content across all perser versions BUT keys are per-sha.
 */
export function contentCacheDriver(): Driver {
  return runtimeCacheDriver(`content:${CONTENT_PARSER_VERSION}`, TTL)
}

/**
 * Shared driver backing the branch + content directory → content commit pointer
 * (`resolveContentSha` in `github.ts`), in its own namespace so every instance reads one pointer
 * instead of keeping its own timer.
 *
 * TODO: Vercel Runtime Cache is **regional**, not global (https://vercel.com/docs/caching/runtime-cache):
 * It assumes Functions run in a single region.
 * Multi-region would confine the webhook's forced refresh to its region (others self-heal on TTL)
 * We should reach for a globally replicated store (e.g. Edge Config).
 */
export function refCacheDriver(): Driver {
  return runtimeCacheDriver('content:refs', REF_TTL)
}

/**
 * Per-commit data Comark knows nothing about (commit history, RSS dates).
 * Namespace is per-sha and keys start with `gh:`.
 */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: runtimeCacheDriver(`content:${CONTENT_PARSER_VERSION}:${sha}`, TTL) })
}
