/**
 * Contract test against the installed `comark-content`.
 *
 * Every other test here imports a pure function and never touches the package,
 * which is how comark-content#77's `metaOnly` -> `partial` rename silently degraded
 * the webhook's body warm-up. This exercises the surface the layer depends on.
 */
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { comarkContent, readArtifact } from 'comark-content'
import fsSource from 'comark-content/sources/fs'
import githubSource from 'comark-content/sources/github'
import { createContentClient } from 'comark-content/client'
import sqliteWasm from 'comark-content/database/sqlite-wasm'
import sqliteFullTextSearch from 'comark-content/plugins/sqlite-full-text-search'
import memoryDriver from 'unstorage/drivers/memory'

const fixture = fileURLToPath(new URL('./fixtures/content-contract', import.meta.url))

/**
 * The warm-up options from `server/api/revalidate.post.ts` — keep the two in step.
 * This object has to keep meaning "full init" on whichever build is installed.
 */
const full = { partial: false, metaOnly: false }

/** `<source>:<path-in-source>` — the cache key comark-content writes a parsed body under. */
const bodyKey = 'content:index.md'

function createFixtureContent() {
  return comarkContent({
    sources: { content: fsSource(fixture) },
    cache: { driver: memoryDriver() },
  })
}

describe('comark-content contract', () => {
  it('exposes every entrypoint the layer imports', () => {
    for (const entry of [
      comarkContent,
      readArtifact,
      fsSource,
      githubSource,
      createContentClient,
      // Browser-only at runtime, but the subpaths resolve under node — enough to catch a rename.
      sqliteWasm,
      sqliteFullTextSearch,
    ]) {
      expect(typeof entry).toBe('function')
    }
  })

  it('builds a manifest from a source on a bare init', async () => {
    const content = createFixtureContent()
    await content.init()

    expect(Object.keys(content.manifest.items)).toHaveLength(1)
    expect(content.manifest.items['/']?.data?.title).toBe('Contract fixture')
  })

  it('writes parsed bodies to the cache on the revalidate warm-up init', async () => {
    const content = createFixtureContent()

    // The metadata pass the webhook runs before responding (revalidate.post.ts:142).
    await content.init()
    // Without this the assertion below would pass even if the warm-up did nothing.
    // `cache.keys` can't stand in — it is derived from the manifest, not the driver.
    expect(await content.cache.get(bodyKey)).toBeNull()

    await content.init(full)

    // The one status spelled the same before and after the rename
    // ('initialized-meta' -> 'initialized-partial').
    expect(content.status).toBe('initialized-full')

    const cached = await content.cache.get(bodyKey)
    expect(cached).not.toBeNull()
    expect(cached!.nodes.length).toBeGreaterThan(0)
  })

  it('produces a snapshot artifact on the revalidate warm-up', async () => {
    const content = createFixtureContent()
    await content.init(full)

    // `warmArtifacts` logs `artifact.size`, so a shape change there degrades to "not produced".
    const artifact = await content.cache.snapshot('content')
    expect(artifact).not.toBeNull()
    expect(artifact!.size).toBeGreaterThan(0)
    expect(Object.keys(await readArtifact(artifact!)).length).toBeGreaterThan(0)
  })

  it('serves the manifest and snapshot artifacts through content.handler', async () => {
    const content = createFixtureContent()
    await content.init(full)

    // The exact paths the search worker fetches and `modules/config.ts` declares ISR rules for.
    for (const path of ['manifest.json', 'snapshot/content.json']) {
      const response = await content.handler(new Request(`http://localhost/api/content/${path}`))
      expect(response.status, path).toBe(200)
      expect(Object.keys(await response.json()), path).toContain('checksum')
    }
  })

  it('hydrates a sourceless instance from those artifacts', async () => {
    const server = createFixtureContent()
    await server.init(full)

    const fetchArtifact = async (path: string) =>
      await (await server.handler(new Request(`http://localhost/api/content/${path}`))).json()

    // The search feature is this round-trip, so a break here is a silently empty search index.
    const client = comarkContent({
      cache: {
        loadManifest: () => fetchArtifact('manifest.json'),
        loadSnapshot: (source: string) => fetchArtifact(`snapshot/${source}.json`),
      },
    })
    await client.init()

    expect(Object.keys(client.manifest.items)).toEqual(['/'])

    // Bodies have to arrive parsed: the client has no source to read a document from.
    const doc = await client.get('/')
    expect(doc?.data?.title).toBe('Contract fixture')
    expect(doc?.nodes?.length).toBeGreaterThan(0)
  })
})
