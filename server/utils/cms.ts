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

/** Shared instance, rebuilt only when the head advances (see `getProdCMS`). */
let cms: ComarkCMS | undefined

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
 */
export async function createSourceCMS(
  ref: string,
  opts: { remote?: boolean; cache?: CacheOptions; basePath?: string } = {}
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

  if (import.meta.dev) {
    instance.watch()
    instance.hooks.hook('watch:file:update', (_source, key) => {
      console.log(`${key} updated`)
    })
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
    cms = await createSourceCMS(getHeadRef(), {
      cache: {
        driver: cacheDriver(getHeadRef()),
      },
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
 * Build (or return the memoized) CMS for a preview commit SHA mounted at `basePath`
 */
export function getPreviewCMS(sha: string, basePath: string): Promise<ComarkCMS> {
  const key = `${basePath}::${sha}`
  let instance = cmsPreviewInstances.get(key)
  if (!instance) {
    instance = createSourceCMS(sha, {
      remote: true,
      basePath,
      cache: { driver: cacheDriver(sha) },
    })
    cmsPreviewInstances.set(key, instance)
  }
  return instance
}
