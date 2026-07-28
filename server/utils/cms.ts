import { createCMS, defineCMSPlugin, type ComarkCMS, type CacheOptions } from '@comark/cms'
import fs from '@comark/cms/sources/fs'
import github from '@comark/cms/sources/github'
import highlight from 'comark/plugins/highlight'
import security from 'comark/plugins/security'
import emoji from 'comark/plugins/emoji'
import toc from 'comark/plugins/toc'
import mermaid from 'comark/plugins/mermaid'
import githubLight from '@shikijs/themes/github-light'
import githubDark from '@shikijs/themes/github-dark'

/**
 * Shared instance, rebuilt only when the head advances (see `getProdCMS`).
 *
 * Holds the *promise*, not the resolved instance: two requests arriving on a cold
 * instance would otherwise both see `undefined` and each build a CMS, since the
 * assignment can only happen after the await.
 */
let cms: Promise<ComarkCMS> | undefined

const comarkPlugins = [
  mermaid({ theme: 'zinc-light', themeDark: 'zinc-dark' }),
  highlight({ themes: { light: githubLight, dark: githubDark } }),
  toc({ depth: 3 }),
  emoji(),
  security({
    blockedTags: ['script', 'iframe', 'embed', 'form', 'base', 'meta', 'link', 'style'],
    allowDataImages: false,
  }),
]

/**
 * Create a new CMS instance reading content at `ref` (a commit SHA or branch).
 *
 * Defaults to an in-memory cache — production pins one SHA per deploy and serves
 * ISR-cached HTML off an in-memory CMS.
 *
 * - `remote: true` forces the GitHub source
 * - `cache` overrides the comark cache (driver + loaders)
 * - `watch: true` enables dev file watching (default off, see below)
 */
export async function createSourceCMS(
  ref: string,
  opts: { remote?: boolean; cache?: CacheOptions; basePath?: string; watch?: boolean } = {}
) {
  // Expose search sections through `cms.handler`, bound to THIS instance so a
  // preview CMS serves its own version's sections, not production's.
  const searchSectionsPlugin = defineCMSPlugin(() => ({
    name: 'search-sections',
    setup(ctx) {
      ctx.addServeHandler('search-sections', async () => Response.json(await buildSearchSections(instance)))
    },
  }))

  const instance = createCMS({
    comark: {
      plugins: comarkPlugins,
      html: false,
    },
    sources: {
      content: contentSource(ref, { remote: opts.remote }),
    },
    plugins: [searchSectionsPlugin()],
    cache: opts.cache,
    basePath: opts.basePath,
  })

  // Only the default instance watches. Every other instance reads a fixed ref
  // (a preview SHA, or the before/after pair in the revalidate webhook) whose
  // content cannot change, and `watch()` returns a stop function we'd have to
  // keep in order to release the watcher — so watching them would be both
  // pointless and a leak once the instance is evicted from the preview registry.
  if (import.meta.dev && opts.watch) {
    await instance.watch()
    instance.hooks.hook('watch:file:update', (_source, key) => {
      // Content changed under a stable instance, so the memoized search index
      // (keyed by instance identity) has to be dropped by hand here.
      invalidateSearchSections(instance)
      console.log(`${key} updated`)
    })
    instance.hooks.hook('watch:file:remove', () => invalidateSearchSections(instance))
  }

  return instance
}

/**
 * The branch this deployment tracks in production. Content-only pushes skip a
 * redeploy (see `vercel.json`'s `ignoreCommand`), so this is resolved live on
 * every prod request rather than baked in at build time.
 */
export function targetBranch(): string {
  return process.env.VERCEL_GIT_COMMIT_REF || useRuntimeConfig().docs.github.branch || 'main'
}

/**
 * The content commit this instance is currently pinned to.
 *
 * Pinning GitHub reads to an immutable SHA — rather than the branch name —
 * bypasses the stale `raw.githubusercontent.com/<branch>` CDN.
 */
let headRef: string | undefined

export function getHeadRef(): string {
  headRef ??= process.env.VERCEL_GIT_COMMIT_SHA || targetBranch()
  return headRef
}

/**
 * Shared CMS for the lifetime of this server instance, pinned to `headRef`.
 *
 * On production (`VERCEL_ENV === 'production'`) every call resolves the
 * current tip of `targetBranch()` via `resolveSha()` — a shared, short-TTL cache
 * (see `server/utils/github.ts` / `cacheDriver`), not a per-instance timer —
 * and evicts + rebuilds the singleton when it has advanced. Preview
 * deployments stay pinned to the exact commit they were built at.
 */
export async function getProdCMS(): Promise<ComarkCMS> {
  if (process.env.VERCEL_ENV === 'production') {
    const sha = await resolveSha(targetBranch())
    if (sha !== getHeadRef()) {
      console.log(`[cms] head ${getHeadRef()} -> ${sha}`)
      headRef = sha
      // The old CMS instance baked its source at the old commit so we drop it;
      // it's rebuilt below at the new commit.
      cms = undefined
    }
  }

  if (!cms) {
    cms = createSourceCMS(getHeadRef(), {
      watch: true,
      cache: {
        driver: cacheDriver(getHeadRef()),
      },
    }).catch((error) => {
      // Don't memoize a failed build — the next request should retry.
      cms = undefined
      throw error
    })
  }
  return cms
}

/**
 * Create a new content source for the given commit SHA or branch.
 */
function contentSource(ref: string, opts: { remote?: boolean } = {}) {
  const { docs } = useRuntimeConfig()

  if (import.meta.dev) {
    if (opts.remote) return gitLocalSource(ref, docs.contentDir)

    // Default (prod-equivalent) reads the working tree.
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
const cmsPreviewInstances = new Map<string, Promise<ComarkCMS>>()

/**
 * How many preview instances one server instance keeps.
 *
 * Each entry holds a CMS with its own manifest and parsed bodies, so this map is
 * unbounded memory if left to grow: `/tree/:branch` and `/blob/:sha` are public,
 * and even with refs validated a crawler walking commit history creates one entry
 * per SHA. Previews are a low-traffic path, so a small LRU is plenty — an evicted
 * ref just rebuilds, and its parsed bodies survive in the per-SHA Runtime Cache.
 */
const MAX_PREVIEW_INSTANCES = 8

/**
 * Build (or return the memoized) CMS for a preview commit SHA mounted at `basePath`
 */
export function getPreviewCMS(sha: string, basePath: string): Promise<ComarkCMS> {
  const key = `${basePath}::${sha}`
  const existing = cmsPreviewInstances.get(key)
  if (existing) {
    // Re-insert so the most recently used key is last — `Map` preserves insertion
    // order, which is the whole LRU.
    cmsPreviewInstances.delete(key)
    cmsPreviewInstances.set(key, existing)
    return existing
  }

  const instance = createSourceCMS(sha, {
    remote: true,
    basePath,
    cache: { driver: cacheDriver(sha) },
  }).catch((error) => {
    cmsPreviewInstances.delete(key)
    throw error
  })
  cmsPreviewInstances.set(key, instance)

  while (cmsPreviewInstances.size > MAX_PREVIEW_INSTANCES) {
    const oldest = cmsPreviewInstances.keys().next()
    if (oldest.done) break
    cmsPreviewInstances.delete(oldest.value)
  }

  return instance
}
