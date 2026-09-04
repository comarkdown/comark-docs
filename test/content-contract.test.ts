/**
 * Contract test against the installed `comark-content`.
 *
 * Every other test here imports a pure function and never touches the package,
 * which is how comark-content#77's `metaOnly` -> `partial` rename silently degraded
 * the webhook's body warm-up. This exercises the surface the layer depends on.
 */
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { comarkContent, DEFAULT_CONTENT_NAME, readArtifact, writeSnapshots } from 'comark-content'
import fsSource from 'comark-content/sources/fs'
import githubSource from 'comark-content/sources/github'
import snapshot, { withSnapshot } from 'comark-content/sources/snapshot'
import { createContentClient } from 'comark-content/client'
import sqliteWasm from 'comark-content/database/sqlite-wasm'
import sqliteFullTextSearch from 'comark-content/plugins/sqlite-full-text-search'
import memoryDriver from 'unstorage/drivers/memory'

const fixture = fileURLToPath(new URL('./fixtures/content-contract', import.meta.url))

/**
 * The warm-up options from `server/api/revalidate.post.ts` — keep the two in step.
 * This object has to keep meaning "full init" on whichever build is installed.
 */
const full = { partial: false }

/**
 * `<name>:<path-in-source>` — the cache key comark-content writes a parsed body
 * under. The prefix is the *instance* name, which defaults to `default`.
 */
const bodyKey = 'default:index.md'

function createFixtureContent() {
  return comarkContent({
    source: fsSource(fixture),
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

    // `manifest` is an async method returning saveable data, not a live property.
    const manifest = await content.manifest()
    expect(Object.keys(manifest.items)).toHaveLength(1)
    expect(manifest.items['/']?.data?.title).toBe('Contract fixture')
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

  it('serves the manifest and snapshot artifacts through content.handler', async () => {
    const content = createFixtureContent()
    await content.init(full)

    // The exact paths the search worker fetches and `modules/config/` declares ISR rules for.
    for (const path of ['manifest.json', `snapshot/${DEFAULT_CONTENT_NAME}.json`]) {
      const response = await content.handler(new Request(`http://localhost/api/content/${path}`))
      expect(response.status, path).toBe(200)
      const artifact = await response.json()
      expect(Object.keys(artifact), path).toContain('checksum')
      expect(Object.keys(await readArtifact(artifact)).length, path).toBeGreaterThan(0)
    }
  })

  it('hydrates a sourceless instance from those artifacts', async () => {
    const server = createFixtureContent()
    await server.init(full)

    const fetchArtifact = async (path: string) =>
      await (await server.handler(new Request(`http://localhost/api/content/${path}`))).json()

    // The search feature is this round-trip, so a break here is a silently empty search index.
    // `snapshot()`'s first argument is the full-body tier; the second (optional) manifest tier
    // lets a bare `init()` skip downloading bodies until a document is actually requested.
    const client = comarkContent({
      source: snapshot(
        () => fetchArtifact(`snapshot/${DEFAULT_CONTENT_NAME}.json`),
        () => fetchArtifact('manifest.json')
      ),
    })
    await client.init()

    expect(Object.keys((await client.manifest()).items)).toEqual(['/'])

    // Bodies have to arrive parsed: the client has no source to read a document from.
    const doc = await client.get('/')
    expect(doc?.data?.title).toBe('Contract fixture')
    expect(doc?.nodes?.length).toBeGreaterThan(0)
  })

  describe('build-time seed', () => {
    /**
     * `modules/snapshot/` writes the seed with `writeSnapshots()`, and
     * `server/utils/content.ts` reads it back through a Nitro server asset. Two things here are
     * layout, not behaviour, and both are silent when wrong: the per-instance subdirectory, and
     * the fact that a server asset hands back JSON *text*.
     */
    async function writeSeed() {
      const dir = await mkdtemp(join(tmpdir(), 'comark-seed-'))
      await writeSnapshots(createFixtureContent(), { dir })
      // One directory per instance, named after it — ours is unnamed, so `default`.
      const read = (file: string) => readFile(join(dir, DEFAULT_CONTENT_NAME, file), 'utf8')
      return { snapshot: () => read('snapshot.json'), manifest: () => read('manifest.json') }
    }

    it('hydrates a withSnapshot instance from the seed without reading the source', async () => {
      const seed = await writeSeed()

      // A source that throws on any read: hydrating from the seed must not touch it. This is the
      // cold start being bought — in production the reads it stands in for are GitHub API calls.
      const unreachable = {
        ...fsSource(fixture),
        keys: () => {
          throw new Error('the origin was walked')
        },
      }

      const content = comarkContent({
        source: withSnapshot(unreachable, seed.snapshot, seed.manifest),
        cache: { driver: memoryDriver() },
      })
      await content.init(full)

      expect(Object.keys((await content.manifest()).items)).toEqual(['/'])
      const doc = await content.get('/')
      expect(doc?.data?.title).toBe('Contract fixture')
      expect(doc?.nodes?.length).toBeGreaterThan(0)
    })

    it('falls back to the source when no seed is stored', async () => {
      // What every ref other than the build commit gets: loaders return `null`, so the origin is
      // the only provider. A seed that cannot prove it belongs to this ref must never be used.
      const content = comarkContent({
        source: withSnapshot(
          fsSource(fixture),
          () => null,
          () => null
        ),
        cache: { driver: memoryDriver() },
      })
      await content.init(full)

      expect(Object.keys((await content.manifest()).items)).toEqual(['/'])
      expect((await content.get('/'))?.data?.title).toBe('Contract fixture')
    })
  })
})
