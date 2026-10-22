import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { expectSelfContainedBundle } from '../server-bundle'

const outputDir = fileURLToPath(new URL('../../playground/.vercel/output/', import.meta.url))
const functionsDir = join(outputDir, 'functions')
const serverDir = join(functionsDir, '__fallback.func')

if (!existsSync(join(outputDir, 'config.json'))) {
  throw new Error('No Vercel build found: run `NITRO_PRESET=vercel pnpm build` before `pnpm test:vercel`.')
}

/** `comarkDocs.isr` default in `modules/config/`, in seconds. */
const TTL = 300

/** Vercel's hard limit is 250 MB, the budget catches a dependency bundling far more than it needs. */
const MAX_FUNCTION_MB = 100

const SHA = 'a'.repeat(40)

interface Route {
  src?: string
  dest?: string
  handle?: string
  status?: number
  headers?: Record<string, string>
  continue?: boolean
}

interface PrerenderConfig {
  expiration: number | false
  bypassToken?: string
}

const readJSON = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T

const { version, routes } = readJSON<{ version: number; routes: Route[] }>(join(outputDir, 'config.json'))

/** The routes Vercel matches once no static file answers, up to the next `handle` phase. */
function functionRoutes(): Route[] {
  const start = routes.findIndex((route) => route.handle === 'filesystem') + 1
  const end = routes.findIndex((route, index) => index >= start && route.handle)
  return routes.slice(start, end === -1 ? undefined : end)
}

/** The function Vercel serves a path from, and its ISR expiration when it is cached. */
function resolveFunction(path: string) {
  // Vercel matches `src` against the whole path.
  const route = functionRoutes().find((route) => route.dest && new RegExp(`^(?:${route.src})$`).test(path))
  const dest = route?.dest?.split('?')[0]
  if (!dest) return undefined

  const prerenderConfig = join(functionsDir, `${dest}.prerender-config.json`)
  const expiration = existsSync(prerenderConfig) ? readJSON<PrerenderConfig>(prerenderConfig).expiration : undefined
  return { dest, expiration }
}

/** Files under `dir`, skipping symlinks such as the ISR functions, which all link to the server function. */
function filesIn(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
}

/** Nitro inlines each server asset as a raw chunk named after the asset, exporting its contents as a string. */
async function readRawAsset<T>(name: string): Promise<T> {
  const chunk = (await import(join(serverDir, 'chunks/raw', `${name}.mjs`))) as { default: string }
  return JSON.parse(chunk.default) as T
}

describe('routing', () => {
  it('uses the Build Output API v3', () => {
    expect(version).toBe(3)
  })

  it('falls back to the server function after the static files', () => {
    expect(routes.some((route) => route.handle === 'filesystem')).toBe(true)
    expect(functionRoutes().at(-1)).toEqual({ src: '/(.*)', dest: '/__fallback' })
  })

  // A header route without `continue` ends the routing before any function (nitrojs/nitro#4651).
  it('lets every header-only route continue', () => {
    const stopping = routes.filter((route) => route.headers && !route.dest && !route.status && route.continue !== true)
    expect(stopping.map((route) => route.src)).toEqual([])
  })
})

describe('ISR', () => {
  // `false` never expires: the response is pinned to a commit SHA.
  it.each([
    ['/', TTL],
    ['/logos', TTL],
    ['/getting-started', TTL],
    ['/getting-started/introduction', TTL],
    ['/getting-started/introduction/_payload.json', TTL],
    ['/tree/main/getting-started/introduction', TTL],
    ['/pr/1/getting-started/introduction', TTL],
    [`/blob/${SHA}/getting-started/introduction`, false],
    [`/blob/${SHA}/getting-started/introduction/_payload.json`, false],
    ['/raw/getting-started/introduction.md', TTL],
    ['/llms.txt', TTL],
    ['/llms-full.txt', TTL],
    ['/sitemap.md', TTL],
    ['/rss.xml', TTL],
    ['/openapi.json', TTL],
    ['/.well-known/skills/index.json', false],
    [`/api/content/blob/${SHA}/manifest.json`, false],
    [`/api/content/blob/${SHA}/snapshot/default.json`, false],
    ['/api/code-explorer/comarkdown/comark-docs/README.md.json', TTL],
  ])('%s is cached with an expiration of %s', (path, expiration) => {
    expect(resolveFunction(path)?.expiration).toBe(expiration)
  })

  // Answers that must reflect the request: the webhook, the assistant stream, MCP and the pinned head commit.
  it.each(['/api/revalidate', '/api/assistant', '/api/content/head', '/mcp'])('%s is not cached', (path) => {
    const resolved = resolveFunction(path)
    expect(resolved?.dest).toBeDefined()
    expect(resolved?.expiration).toBeUndefined()
  })

  // The push webhook purges pages with it, without one content updates wait for the TTL.
  it('gives every ISR function the same bypass token', () => {
    const configs = filesIn(functionsDir)
      .filter((file) => file.endsWith('.prerender-config.json'))
      .map((file) => ({ file: relative(functionsDir, file), ...readJSON<PrerenderConfig>(file) }))

    expect(configs.length).toBeGreaterThan(0)
    // File names only: the token itself must not reach the logs.
    expect(configs.filter((config) => !config.bypassToken).map((config) => config.file), 'build with `VERCEL_BYPASS_TOKEN` set').toEqual([])
    expect(new Set(configs.map((config) => config.bypassToken)).size).toBe(1)
  })
})

describe('server function', () => {
  const { runtime, supportsResponseStreaming } = readJSON<{ runtime: string; supportsResponseStreaming?: boolean }>(join(serverDir, '.vc-config.json'))

  it('runs on Node.js', () => {
    expect(runtime).toMatch(/^nodejs\d+\.x$/)
  })

  // The assistant streams its answer, a buffered response would only show up at the end.
  it('streams responses', () => {
    expect(supportsResponseStreaming).toBe(true)
  })

  it(`stays under ${MAX_FUNCTION_MB} MB`, () => {
    const bytes = filesIn(serverDir).reduce((total, file) => total + lstatSync(file).size, 0)
    expect(bytes / 1024 / 1024).toBeLessThan(MAX_FUNCTION_MB)
  })

  // Vercel uploads the function directory alone, with its own traced `node_modules/`.
  it('resolves every import inside the function', async () => {
    await expectSelfContainedBundle(serverDir)
  })

  // Without it a cold start walks the content repository on GitHub.
  it('bundles the content snapshot and its manifest, stamped with one commit', async () => {
    const snapshot = await readRawAsset<{ ref: string; items: Array<{ path: string }> }>('snapshot')
    const manifest = await readRawAsset<{ ref: string }>('manifest')

    expect(snapshot.ref).toMatch(/^[0-9a-f]{40}$/)
    expect(manifest.ref).toBe(snapshot.ref)
    expect(snapshot.items.map((item) => item.path)).toContain('/getting-started/introduction')
  })
})
