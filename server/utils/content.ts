import { type CacheOptions, comarkContent } from 'comark-content'
import fs from 'comark-content/sources/fs'
import github from 'comark-content/sources/github'
import rangi from 'comark/plugins/rangi'
import security from 'comark/plugins/security'
import emoji from 'comark/plugins/emoji'
import toc from 'comark/plugins/toc'
import mermaid from 'comark/plugins/mermaid'
import markdown from 'comark-content/plugins/markdown'
import yaml from 'comark-content/plugins/yaml'
import tracingOtel from 'comark-content/plugins/tracing/otel'
import { contentTracer } from './tracer.ts'
import { geistTheme } from '../../utils/geist-theme.ts'

/**
 * The instance this layer builds, derived from the factory rather than written
 * out.
 *
 * `ComarkContent` is the *unnarrowed* shape: its instance-name parameter drives
 * the conditional types behind `get()` and `list()`, so a concrete instance is
 * not assignable to it. Deriving instead of annotating keeps the narrowing that
 * `comark-content prepare` generates — `get('/known/path')` stays typed all the
 * way through the layer.
 */
export type DocsContent = Awaited<ReturnType<typeof createSourceContent>>

const DEFAULT_LISTING_FIELDS = ['title', 'description', 'navigation', 'icon', 'layout']

// Rebuilt only when the head advances (see `getProdContent`). Holds the *promise*, not the instance: the
// assignment lands after the await, so two requests on a cold instance would each build a CMS.
let content: Promise<DocsContent> | undefined

// Bump CONTENT_PARSER_VERSION in `cache.ts` when these plugins or their options change cached output.
const comarkPlugins = [
  mermaid({ theme: 'zinc-light', themeDark: 'zinc-dark' }),
  rangi({ theme: geistTheme }),
  toc({ depth: 3 }),
  emoji(),
  security({
    blockedTags: ['script', 'iframe', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    allowDataImages: false,
  }),
]

/**
 * Create a new content instance reading content at `ref` (a commit SHA or branch).
 * - `remote` forces the GitHub source
 * - `cache` overrides comark's (in-memory by default)
 * - `basePath` is the base path for the content instance
 * - `watch` is dev file watching
 */
export async function createSourceContent(
  ref: string,
  opts: { remote?: boolean; cache?: CacheOptions; basePath?: string; watch?: boolean } = {}
) {
  const tracer = contentTracer()
  const listingFields = useRuntimeConfig().docs.listingFields ?? DEFAULT_LISTING_FIELDS
  const instance = comarkContent({
    source: contentSource(ref, { remote: opts.remote }),
    plugins: [
      // Registers the `.md` parser itself, so the top-level `markdown:` option (which can't take
      // `listingFields`) would just be dead config here — this plugin call is the only one comarkContent
      // needs.
      markdown({
        comark: { plugins: comarkPlugins },
        listingFields,
      }),
      yaml({ listingFields }),
      tracer && tracingOtel({ tracer }),
    ],
    cache: opts.cache,
    basePath: opts.basePath,
  })

  // Only the default instance watches: others read a fixed ref that can't change, and retaining
  // `watch()`'s stop function to release the watcher would leak once the preview entry is evicted.
  if (import.meta.dev && opts.watch) {
    await instance.watch()
    instance.hooks.hook('watch:file:update', (_source:string, key: string) => {
      invalidateSearchSections(instance)
      console.log(`${key} updated`)
    })
    instance.hooks.hook('watch:file:remove', () => invalidateSearchSections(instance))
  }

  return instance
}

/**
 * Fully parse the content into this instance's per-SHA cache, then persist the served manifest and
 * snapshot artifacts so the next reader (a fresh instance sharing the same cache namespace, or the
 * search worker's fetch) pays a single cache read instead of a rebuild.
 *
 * comark-content 0.4 keeps artifact building internal (`ArtifactStore`, reachable only through
 * `content.handler()`) — there's no public equivalent of 0.3's `cache.snapshot(source)`. Self-requesting
 * the instance's own handler hits the same build-then-persist path the browser's first fetch would,
 * just warmed ahead of time.
 */
export async function warmArtifacts(content: DocsContent): Promise<void> {
  await content.init({ partial: false })
  const basePath = content.options.basePath ?? '/api/content'
  for (const section of ['manifest', `snapshot/${content.name}`]) {
    const response = await content.handler(new Request(`http://local${basePath}/${section}`))
    if (response.ok) console.log(`[content] warmed "${section}" artifact`)
    else console.warn(`[content] failed to warm "${section}" artifact: ${response.status}`)
  }
}

// The content commit this instance is pinned to. Pinning GitHub reads to an immutable SHA rather
// than the branch name bypasses the stale `raw.githubusercontent.com/<branch>` CDN.
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

/**
 * Shared content instance for the lifetime of this server instance, pinned to `headRef`. In production every
 * call resolves the current head via `resolveProdSha()` — a shared, short-TTL cache, not a per-instance
 * timer — and rebuilds when that advances. Previews stay pinned.
 */
export async function getProdContent(): Promise<DocsContent> {
  if (['production', 'preview'].includes(process.env.VERCEL_ENV || '')) {
    const sha = await resolveProdSha()
    if (sha !== getHeadRef()) {
      console.log(`[content] head ${getHeadRef()} -> ${sha}`)
      headRef = sha
      content = undefined // the old instance baked its source at the old commit
    }
  }

  if (!content) {
    content = createSourceContent(getHeadRef(), {
      watch: true,
      cache: {
        driver: cacheDriver(getHeadRef()),
      },
    }).catch((error) => {
      // Don't memoize a failed build — the next request should retry.
      content = undefined
      throw error
    })
  }
  return content
}

function contentSource(ref: string, opts: { remote?: boolean } = {}) {
  const { docs } = useRuntimeConfig()

  if (import.meta.dev) {
    if (opts.remote) return gitLocalSource(ref, docs.contentDir)

    return fs(docs.contentPath)
  }

  return github({
    repo: githubRepo(),
    branch: ref,
    path: docs.contentDir,
    token: githubToken(),
    // `ref` is an immutable commit SHA => we can cache hard.
    ttl: 60 * 60 * 24,
  })
}

/** Per-instance registry of preview CMS instances, keyed by `<basePath>::<sha>`. */
const contentPreviewInstances = new Map<string, Promise<DocsContent>>()

// Bound required: each entry is a content instance with its own manifest and parsed bodies, and public
// `/tree/:branch` / `/blob/:sha` let a crawler mint one per SHA. Evicted refs just rebuild, their
// bodies surviving in the per-SHA Runtime Cache.
const MAX_PREVIEW_INSTANCES = 8

export function getPreviewContent(sha: string, basePath: string): Promise<DocsContent> {
  const key = `${basePath}::${sha}`
  const existing = contentPreviewInstances.get(key)
  if (existing) {
    // `Map` preserves insertion order, which is the whole LRU: re-insert so the MRU key is last.
    contentPreviewInstances.delete(key)
    contentPreviewInstances.set(key, existing)
    return existing
  }

  const instance = createSourceContent(sha, {
    remote: true,
    basePath,
    cache: { driver: cacheDriver(sha) },
  }).catch((error) => {
    contentPreviewInstances.delete(key)
    throw error
  })
  contentPreviewInstances.set(key, instance)

  while (contentPreviewInstances.size > MAX_PREVIEW_INSTANCES) {
    const oldest = contentPreviewInstances.keys().next()
    if (oldest.done) break
    contentPreviewInstances.delete(oldest.value)
  }

  return instance
}
