import { describe, expect, it } from 'vitest'
import { buildMarkdownRewriteRoutes, type VercelRoute } from '../utils'

// Vercel resolves `$n` in `headers.Location` from the capture groups of `src` — replicate that to
// assert on the final redirect target rather than on regex internals.
function redirect(routes: VercelRoute[], path: string): VercelRoute & { location: string } | null {
  for (const route of routes) {
    const match = path.match(new RegExp(route.src))
    if (!match) continue
    const location = (route.headers?.Location ?? '').replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? '')
    return { ...route, location }
  }
  return null
}

const routes = buildMarkdownRewriteRoutes()

describe('buildMarkdownRewriteRoutes', () => {
  it('pairs every redirect with an Accept matcher and a curl matcher', () => {
    expect(routes.length % 2).toBe(0)
    const conditions = routes.map((route) => route.has?.[0])
    expect(conditions.filter((c) => c?.key === 'accept').length).toBe(routes.length / 2)
    expect(conditions.filter((c) => c?.key === 'user-agent').length).toBe(routes.length / 2)
  })

  it('uses a 307 redirect (never a rewrite, which would share the ISR cache entry) and varies on Accept', () => {
    for (const route of routes) {
      expect(route.status).toBe(307)
      expect(route.headers?.Location).toBeTruthy()
      expect(route.headers?.vary).toBe('Accept')
    }
  })

  it('sends the landing page to llms.txt', () => {
    expect(redirect(routes, '/')?.location).toBe('/llms.txt')
  })

  it('sends pages to their raw markdown mirror', () => {
    expect(redirect(routes, '/getting-started/installation')?.location).toBe(
      '/raw/getting-started/installation.md'
    )
    expect(redirect(routes, '/getting-started/installation/')?.location).toBe(
      '/raw/getting-started/installation.md'
    )
    expect(redirect(routes, '/writing')?.location).toBe('/raw/writing.md')
  })

  it('never redirects versioned previews (no raw mirrors, HTML only)', () => {
    for (const path of [
      '/tree/main',
      '/tree/release%2Fv1.2/writing/pages',
      '/blob/a1b2c3d',
      '/blob/a1b2c3d/getting-started/introduction',
      '/pr/28',
      '/pr/28/getting-started/introduction',
    ]) {
      expect(redirect(routes, path), path).toBeNull()
    }
  })

  it('never redirects the mirrors, APIs, internals or dotted paths', () => {
    for (const path of [
      '/raw/getting-started/installation.md',
      '/api/content/search-sections',
      '/api/assistant',
      '/mcp',
      '/logos',
      '/_nuxt/entry.js',
      '/__nuxt_island/foo',
      '/llms.txt',
      '/llms-full.txt',
      '/sitemap.xml',
      '/rss.xml',
      '/robots.txt',
      '/favicon.ico',
      '/.well-known/skills/index.json',
    ]) {
      expect(redirect(routes, path), path).toBeNull()
    }
  })
})
