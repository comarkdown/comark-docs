import { type ComarkContent, type CacheOptions, comarkContent } from 'comark-content';
import fs from 'comark-content/sources/fs'
import github from 'comark-content/sources/github'
import rangi from 'comark/plugins/rangi'
import security from 'comark/plugins/security'
import emoji from 'comark/plugins/emoji'
import toc from 'comark/plugins/toc'
import mermaid from 'comark/plugins/mermaid'
import yaml from 'comark-content/plugins/yaml'
import tracingOtel from 'comark-content/plugins/tracing/otel'
import { githubLight, githubDark } from 'rangi/themes'
import { contentTracer } from './tracer.ts'

// Rebuilt only when the head advances (see `getProdContent`). Holds the *promise*, not the instance: the
// assignment lands after the await, so two requests on a cold instance would each build a CMS.
let content: Promise<ComarkContent> | undefined

// Bump CONTENT_PARSER_VERSION in `cache.ts` when these plugins or their options change cached output.
const comarkPlugins = [
  mermaid({ theme: 'zinc-light', themeDark: 'zinc-dark' }),
  rangi({ theme: { light: githubLight, dark: githubDark } }),
  toc({ depth: 3 }),
  emoji(),
  security({
    blockedTags: ['script', 'iframe', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    allowDataImages: false,
  }),
]

/**
 * Create a new content instance reading content at `ref` (a commit SHA or branch). `remote` forces the
 * GitHub source, `cache` overrides comark's (in-memory by default), `watch` is dev file watching.
 */
export async function createSourceContent(
  ref: string,
  opts: { remote?: boolean; cache?: CacheOptions; basePath?: string; watch?: boolean } = {}
) {
  // A no-op unless the consumer shadows it from their own `server/utils/`. Re-typed as the layer's own
  // options: a consumer's hook is declared against the wide `ContentOptions`, and letting that widen the
  // argument would erase the source and plugin types `comarkContent` infers from the literal.
  const tracer = contentTracer()
  const instance = comarkContent({
    markdown: {
      plugins: comarkPlugins,
    },
    sources: {
      content: contentSource(ref, { remote: opts.remote }),
    },
    plugins: [
      yaml(), // enable .navigation.yml to be detected
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
 * Fully parse and persist the snapshot artifact into this instance's per-SHA cache.
 */
export async function warmSnapshot(content: ComarkContent): Promise<void> {
  await content.init({ partial: false })
  const artifact = await content.cache.snapshot('content')
  console.log(`[content] snapshot artifact ${artifact ? `${artifact.size} bytes` : 'not produced'}`)
}

/** Production branch, resolved per request: content pushes skip redeploys (`vercel.json` `ignoreCommand`). */
export function targetBranch(): string {
  return process.env.VERCEL_GIT_COMMIT_REF || useRuntimeConfig().docs.github.branch || 'main'
}

// The content commit this instance is pinned to. Pinning GitHub reads to an immutable SHA rather
// than the branch name bypasses the stale `raw.githubusercontent.com/<branch>` CDN.
let headRef: string | undefined

export function getHeadRef(): string {
  headRef ??= targetBranch()
  return headRef
}

/**
 * Shared content instance for the lifetime of this server instance, pinned to `headRef`. In production every
 * call resolves the latest commit touching the content directory via `resolveContentSha()` — a shared,
 * short-TTL cache, not a per-instance timer — and rebuilds when that advances. Previews stay pinned.
 */
export async function getProdContent(): Promise<ComarkContent> {
  if (['production', 'preview'].includes(process.env.VERCEL_ENV || '')) {
    const { contentDir } = useRuntimeConfig().docs
    const sha = await resolveContentSha(targetBranch(), contentDir)
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
const contentPreviewInstances = new Map<string, Promise<ComarkContent>>()

// Bound required: each entry is a content instance with its own manifest and parsed bodies, and public
// `/tree/:branch` / `/blob/:sha` let a crawler mint one per SHA. Evicted refs just rebuild, their
// bodies surviving in the per-SHA Runtime Cache.
const MAX_PREVIEW_INSTANCES = 8

export function getPreviewContent(sha: string, basePath: string): Promise<ComarkContent> {
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
