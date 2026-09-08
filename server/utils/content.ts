import { type ContentSource, DEFAULT_CONTENT_NAME } from 'comark-content'
import fs from 'comark-content/sources/fs'
import github from 'comark-content/sources/github'
import { withSnapshot } from 'comark-content/sources/snapshot'
import { createRuntimeContentInstance } from '../../utils/content.ts'

/**
 * The instance this layer serves from, derived from the factory rather than written out.
 *
 * `ComarkContent` is the *unnarrowed* shape: its instance-name parameter drives the conditional
 * types behind `get()` and `list()`, so a concrete instance is not assignable to it. Deriving
 * instead of annotating keeps the narrowing that `comark-content prepare` generates —
 * `get('/known/path')` stays typed all the way through the layer.
 */
export type DocsContent = ReturnType<typeof createBaseContent>

/**
 * One instance per process holds the source, the plugins and the cache driver. Every instance that
 * serves requests is `base.withRef(sha)`: the same options, pinned to a commit, with its own index
 * and its own cache namespace (`ref:<sha>:` under `contentCacheDriver()`). Nothing is ever read
 * from the base itself in production; in development it is the unpinned, watched instance.
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
 * An instance pinned to `sha`. Cheap to create: no read happens until the first call. Keep it for
 * as long as you serve that commit, and `dispose()` it when you replace it.
 */
export function contentAt(sha: string): DocsContent {
  return getBaseContent().withRef(sha)
}

// The content commit this process serves. Pinning GitHub reads to an immutable SHA rather than the
// branch name bypasses the stale `raw.githubusercontent.com/<branch>` CDN.
let headRef: string | undefined

export function getHeadRef(): string {
  headRef ??= targetBranch()
  return headRef
}

/**
 * The SHA production should currently serve:
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

// Rebuilt only when the head advances (see `getProdContent`). Holds the *promise*, not the instance:
// the assignment lands after the await, so two requests on a cold process would each build one.
let prod: Promise<DocsContent> | undefined

/**
 * Shared content instance for the lifetime of this process, pinned to `headRef`. In production every
 * call resolves the current head via `resolveProdSha()` — a shared, short-TTL cache, not a per-process
 * timer — and swaps to a new pinned instance when it advances. Previews stay pinned.
 */
export async function getProdContent(): Promise<DocsContent> {
  if (['production', 'preview'].includes(process.env.VERCEL_ENV || '')) {
    const sha = await resolveProdSha()
    if (sha !== getHeadRef()) {
      console.log(`[content] head ${getHeadRef()} -> ${sha}`)
      headRef = sha
      // The old instance is pinned to the old commit; release it. Its cache entries stay for
      // anything still reading `/blob/<old sha>`.
      void prod?.then((instance) => instance.dispose()).catch(() => {})
      prod = undefined
    }
  }

  if (!prod) {
    prod = (async () => {
      // Development reads the working tree and watches it; production and previews read a commit.
      const instance = import.meta.dev ? await watchedDevContent() : contentAt(getHeadRef())
      const startedAt = performance.now()
      await instance.init()
      recordDuration('content.init.ms', startedAt)
      return instance
    })().catch((error) => {
      // Don't memoize a failed build — the next request should retry.
      prod = undefined
      throw error
    })
  }
  return prod
}

/** The unpinned base in development: it reads the working tree and follows file changes. */
async function watchedDevContent(): Promise<DocsContent> {
  const instance = getBaseContent()
  await instance.watch()
  instance.hooks.hook('watch:file:update', (_source: string, key: string) => {
    invalidateSearchSections(instance)
    console.log(`${key} updated`)
  })
  instance.hooks.hook('watch:file:remove', () => invalidateSearchSections(instance))
  return instance
}

/**
 * The source every instance derives from. `withRef(sha)` pins it to a commit:
 * - in production the GitHub source reads its tree and files at `sha`, and the build-time snapshot
 *   supplies every body whose source text did not change since the build;
 * - in development the working tree is read unpinned, and a pinned instance reads the local git
 *   history at `sha` instead (previews).
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

  // The snapshot shipped during build by `modules/snapshot/`. It carries the commit it was parsed
  // at, so it is returned for every ref: at that commit it is the index, at any other commit
  // comark-content walks the commit for the index and reuses the unchanged bodies by hash.
  return withSnapshot(source, () => readSnapshot())
}

/**
 * Read the build-time snapshot, or nothing when this deployment did not ship one.
 *
 * Timed because the duration is the point: the lazy import of the bundled chunk plus its JSON parse.
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

/** Per-process registry of preview instances, keyed by commit. */
const previews = new Map<string, DocsContent>()

// Bound required: each entry holds an index in memory, and public `/tree/:branch` / `/blob/:sha`
// let a crawler mint one per SHA. An evicted entry is disposed; its bodies survive in the shared
// cache under its `ref:` namespace, so rebuilding it later is a cache read, not a walk.
const MAX_PREVIEW_INSTANCES = 8

export function getPreviewContent(sha: string): DocsContent {
  const existing = previews.get(sha)
  if (existing) {
    // `Map` preserves insertion order, which is the whole LRU: re-insert so the MRU key is last.
    previews.delete(sha)
    previews.set(sha, existing)
    return existing
  }

  const instance = contentAt(sha)
  previews.set(sha, instance)

  while (previews.size > MAX_PREVIEW_INSTANCES) {
    const oldest = previews.keys().next()
    if (oldest.done) break
    const evicted = previews.get(oldest.value)
    previews.delete(oldest.value)
    void evicted?.dispose().catch(() => {})
  }

  return instance
}

/**
 * Serve a preview request through the instance pinned to `sha`. Preview routes are mounted under
 * `/api/content/<kind>/<ref>`; every instance's handler expects the shared base path, so the
 * `/<kind>/<ref>` segment is stripped before dispatch (`/api/content/blob/abc/get/x` becomes
 * `/api/content/get/x`). Pass the segment as it appears in the URL, un-decoded. Head-of-branch
 * requests reuse the shared prod instance instead of a duplicate preview pinned to the same commit.
 */
export async function servePreview(event: Parameters<typeof toWebRequest>[0], sha: string, segment: string) {
  const request = toWebRequest(event)
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(segment, '')
  const rewritten = new Request(url, request)

  if (sha === getHeadRef()) {
    const instance = await getProdContent()
    // `getProdContent()` may have advanced the head; re-check before reusing it.
    if (sha === getHeadRef()) return instance.handler(rewritten)
  }
  return getPreviewContent(sha).handler(rewritten)
}
