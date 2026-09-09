import { type ContentSource, DEFAULT_CONTENT_NAME } from 'comark-content'
import fs from 'comark-content/sources/fs'
import github from 'comark-content/sources/github'
import { withSnapshot } from 'comark-content/sources/snapshot'
import { createRuntimeContentInstance } from '../../utils/content.ts'

/**
 * The instance serving requests in this layer.
 */
export type DocsContent = ReturnType<typeof createBaseContent>

/**
 * Holds the source, the plugins and the cache driver.
 * Once per function invocation.
 * Base for all instances "cloned" with `withRef(sha)` in `contentAt()`.
 */
let base: DocsContent | undefined

function getBaseContent(): DocsContent {
  base ??= createBaseContent()
  return base
}

function createBaseContent() {
  return createRuntimeContentInstance({
    source: contentSource(),
    cache: { driver: contentCacheDriver() },
  })
}

/**
 * Base instance cloned and pinned to a SHA.
 * Nothing is read until the first call.
 * `dispose()` it when you replace it.
*/
export function contentAt(sha: string): DocsContent {
  return getBaseContent().withRef(sha)
}

// The content commit currently served.
// Pin GitHub reads to an immutable SHA:
// bypasses the stale `raw.githubusercontent.com/<branch>` CDN.
let headRef: string | undefined

export function getHeadRef(): string {
  headRef ??= targetBranch()
  return headRef
}

/**
 * The SHA prod instance currently serves:
 * - global config pin if one is set (production only)
 * - latest commit touching the content directory via `resolveContentSha()`
 */
export async function resolveProdSha(): Promise<string> {
  const { contentDir } = useRuntimeConfig().docs
  if (process.env.VERCEL_ENV === 'production') {
    const pinned = await getPinnedSha()
    if (pinned) return pinned
  }
  return resolveContentSha(targetBranch(), contentDir)
}

// Rebuild the promise when the head advances.
// Holds the promise to ensure two requests on a cold process don't each build one.
let prod: Promise<DocsContent> | undefined

/**
 * Shared instance for the lifetime of the process, pinned to `headRef`.
 * Always resolves the head via `resolveProdSha()`.
 * Swaps to a new pinned instance when the head advances.
 */
export async function getProdContent(): Promise<DocsContent> {
  if (['production', 'preview'].includes(process.env.VERCEL_ENV || '')) {
    const sha = await resolveProdSha()
    if (sha !== getHeadRef()) {
      console.log(`[comark-docs] New head: ${getHeadRef()} -> ${sha}`)
      headRef = sha
      void prod?.then((instance) => instance.dispose()).catch(() => {})
      prod = undefined
    }
  }

  if (!prod) {
    prod = (async () => {
      const instance = import.meta.dev ? await watchedDevContent() : contentAt(getHeadRef())
      const startedAt = performance.now()
      await instance.init()
      recordDuration('content.init.ms', startedAt)
      return instance
    })().catch((error) => {
      prod = undefined
      throw error
    })
  }
  return prod
}

/** The unpinned base in development — it reads the working tree and follows file changes. */
async function watchedDevContent(): Promise<DocsContent> {
  const instance = getBaseContent()
  await instance.watch()
  instance.hooks.hook('watch:file:update', (_source: string, key: string) => {
    invalidateSearchSections(instance)
    console.log(`[comark-docs] ${key} updated`)
  })
  instance.hooks.hook('watch:file:remove', () => invalidateSearchSections(instance))
  return instance
}

/**
 * The source every instance derives from.
 * `withRef(sha)` pins it to a commit.
 *
 * Production:
 * - GitHub reads the tree and files at `sha`
 * - the build snapshot supplies every body whose source hash is unchanged
 *
 * Development:
 * - unpinned reads the working tree, which `watch()` follows
 * - pinned reads the repo at that commit
 * - no snapshot
 */
function contentSource(): ContentSource {
  const { docs } = useRuntimeConfig()

  if (import.meta.dev) {
    return {
      ...fs(docs.contentPath),
      withRef: (ref) => gitLocalSource(ref, docs.contentDir),
    }
  }

  const source = github({
    repo: githubRepo(),
    branch: targetBranch(),
    path: docs.contentDir,
    token: githubToken(),
    // Reads happen through `withRef(<sha>)`, an immutable commit => cache hard.
    ttl: 60 * 60 * 24,
  })

  // Snaphot build during build time by `modules/snapshot/` is used.
  // Snpahost is pinned to the latest commit at the time of the build.
  // First head moves, only the bodies whose source hash matches are reused.
  return withSnapshot(source, () => readSnapshot())
}

/**
 * Read the build-time snapshot, or nothing when this deployment did not ship one.
 */
async function readSnapshot(): Promise<unknown> {
  const span = contentTracer()?.startSpan('snapshot:read')
  const startedAt = performance.now()
  try {
    // Untyped read: unstorage runs every value through `destr`, so this arrives already parsed.
    const data = await useStorage('assets:comark-content').get(`${DEFAULT_CONTENT_NAME}/snapshot.json`)
    const hit = data != null
    span?.setAttribute('comark.snapshot.hit', hit)
    recordDuration('content.snapshot.read.ms', startedAt, { hit: String(hit) })
    return data
  } finally {
    span?.end()
  }
}
