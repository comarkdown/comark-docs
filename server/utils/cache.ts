import { createStorage, type Driver, type Storage } from 'unstorage'
import memoryDriver from 'unstorage/drivers/memory'
import vercelRuntimeCache from 'unstorage/drivers/vercel-runtime-cache'

/** Whether the Vercel Runtime Cache is available (i.e. running on Vercel). */
function cacheAvailable(): boolean {
  return !import.meta.dev && Boolean(process.env.VERCEL)
}

/** Every namespace below degrades to per-process memory off Vercel if not available. */
function runtimeCacheDriver(base: string, ttl?: number): Driver {
  if (!cacheAvailable()) return memoryDriver()
  return vercelRuntimeCache({ base, ttl })
}

/**
 * Bump when content parser/plugin configuration, relevant parser dependencies, or cached derived
 * data changes. Keeping this explicit lets unrelated deployments reuse immutable content artifacts.
 */
export const CONTENT_PARSER_VERSION = 'v5'

/**
 * A ref pinned via `withRef()` is treated as immutable, so it can be cached for a long time.
 */
const IMMUTABLE_TTL = 60 * 60 * 24

/**
 * Comark cache: index, parsed bodies and artifacts of every commit.
 * Base namespace is per parser version and keys are per-sha.
 */
export function contentCacheDriver(): Driver {
  return runtimeCacheDriver(`content:${CONTENT_PARSER_VERSION}`, IMMUTABLE_TTL)
}

/**
 * Shared driver backing branch pointers and preview authorization decisions (`github.ts`).
 * The branch is mutable, so the TTL is bounded.
 *
 * TODO: Vercel Runtime Cache is **regional**, not global (https://vercel.com/docs/caching/runtime-cache):
 * It assumes Functions run in a single region.
 * Multi-region would confine the webhook's forced refresh to its region (others self-heal on TTL)
 * We should reach for a globally replicated store (e.g. Edge Config).
 */
export function refCacheDriver(ttl: number): Driver {
  return runtimeCacheDriver('content:refs:v2', ttl)
}

/**
 * Per-commit data Comark knows nothing about (RSS dates).
 * Namespace is per-sha and keys start with `gh:`.
 */
export function shaCacheStorage(sha: string): Storage {
  return createStorage({ driver: runtimeCacheDriver(`content:${CONTENT_PARSER_VERSION}:${sha}`, IMMUTABLE_TTL) })
}

/** Short TTL. `branch` is mutable. */
const BRANCH_TTL = 60

/**
 * Per-branch data that must stay live (commit history).
 */
export function branchCacheStorage(branch: string): Storage {
  return createStorage({ driver: runtimeCacheDriver(`content:branch:v1:${encodeURIComponent(branch)}`, BRANCH_TTL) })
}
