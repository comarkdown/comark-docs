/**
 * Contract test against the installed `comark-content`.
 *
 * Every other test here imports a pure function and never touches the package,
 * which is how comark-content#77's `metaOnly` -> `partial` rename silently degraded
 * the webhook's body warm-up. This exercises the surface the layer depends on.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createContent, defineContentPlugin } from 'comark-content'
import fsSource from 'comark-content/sources/fs'
import githubSource from 'comark-content/sources/github'
import { createContentClient, defineContentClientPlugin } from 'comark-content/client'
import memoryDriver from 'unstorage/drivers/memory'

const fixture = fileURLToPath(new URL('./fixtures/cms-contract', import.meta.url))

/**
 * The warm-up options from `server/api/revalidate.post.ts` — keep the two in step.
 * This object has to keep meaning "full init" on whichever build is installed.
 */
const full = { partial: false, metaOnly: false }

/** `<source>:<path-in-source>` — the cache key the CMS writes a parsed body under. */
const bodyKey = 'content:index.md'

function createFixtureCMS() {
  return createContent({
    sources: { content: fsSource(fixture) },
    cache: { driver: memoryDriver() },
  })
}

describe('comark-content contract', () => {
  it('exposes every entrypoint the layer imports', () => {
    for (const entry of [createContent, defineContentPlugin, fsSource, githubSource, createContentClient, defineContentClientPlugin]) {
      expect(typeof entry).toBe('function')
    }
  })

  it('builds a manifest from a source on a bare init', async () => {
    const cms = createFixtureCMS()
    await cms.init()

    expect(Object.keys(cms.manifest.items)).toHaveLength(1)
    expect(cms.manifest.items['/']?.data?.title).toBe('Contract fixture')
  })

  it('writes parsed bodies to the cache on the revalidate warm-up init', async () => {
    const cms = createFixtureCMS()

    // The metadata pass the webhook runs before responding (revalidate.post.ts:142).
    await cms.init()
    // Without this the assertion below would pass even if the warm-up did nothing.
    // `cache.keys` can't stand in — it is derived from the manifest, not the driver.
    expect(await cms.cache.get(bodyKey)).toBeNull()

    await cms.init(full)

    // The one status spelled the same before and after the rename
    // ('initialized-meta' -> 'initialized-partial').
    expect(cms.status).toBe('initialized-full')

    const cached = await cms.cache.get(bodyKey)
    expect(cached).not.toBeNull()
    expect(cached!.nodes.length).toBeGreaterThan(0)
  })

  it('dispatches plugin serve handlers through cms.handler', async () => {
    // Mirrors the `search-sections` plugin in server/utils/content.ts.
    const ping = defineContentPlugin(() => ({
      name: 'ping',
      setup(ctx) {
        ctx.addServeHandler('ping', async () => Response.json({ ok: true }))
      },
    }))

    const cms = createContent({
      sources: { content: fsSource(fixture) },
      cache: { driver: memoryDriver() },
      plugins: [ping()],
    })

    const response = await cms.handler(new Request('http://localhost/api/content/ping'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })
})
