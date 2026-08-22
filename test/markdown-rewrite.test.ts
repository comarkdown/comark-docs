import { describe, expect, it } from 'vitest'
import { buildMarkdownRewriteRoutes, type VercelRoute } from '../utils/markdown-rewrite'

// Vercel resolves `$n` in `dest` from the capture groups of `src` — replicate that to assert on the
// final rewritten path rather than on regex internals.
function rewrite(routes: VercelRoute[], path: string): VercelRoute & { resolved: string } | null {
  for (const route of routes) {
    const match = path.match(new RegExp(route.src))
    if (!match) continue
    const resolved = route.dest.replace(/\$(\d+)/g, (_, n) => match[Number(n)] ?? '')
    return { ...route, resolved }
  }
  return null
}

const routes = buildMarkdownRewriteRoutes()

describe('buildMarkdownRewriteRoutes', () => {
  it('pairs every rewrite with an Accept matcher and a curl matcher', () => {
    expect(routes.length % 2).toBe(0)
    const conditions = routes.map((route) => route.has?.[0])
    expect(conditions.filter((c) => c?.key === 'accept').length).toBe(routes.length / 2)
    expect(conditions.filter((c) => c?.key === 'user-agent').length).toBe(routes.length / 2)
  })

  it('sets the markdown content type and varies on Accept', () => {
    for (const route of routes) {
      expect(route.headers?.['content-type']).toBe('text/markdown; charset=utf-8')
      expect(route.headers?.vary).toBe('Accept')
    }
  })

  it('sends the landing page to llms.txt', () => {
    expect(rewrite(routes, '/')?.resolved).toBe('/llms.txt')
  })

  it('sends pages to their raw markdown mirror', () => {
    expect(rewrite(routes, '/getting-started/installation')?.resolved).toBe(
      '/raw/getting-started/installation.md'
    )
    expect(rewrite(routes, '/getting-started/installation/')?.resolved).toBe(
      '/raw/getting-started/installation.md'
    )
    expect(rewrite(routes, '/writing')?.resolved).toBe('/raw/writing.md')
  })

  it('sends versioned previews to the raw preview mirrors', () => {
    expect(rewrite(routes, '/tree/main')?.resolved).toBe('/raw/tree/main/index.md')
    expect(rewrite(routes, '/blob/a1b2c3d')?.resolved).toBe('/raw/blob/a1b2c3d/index.md')
    expect(rewrite(routes, '/tree/release%2Fv1.2/writing/pages')?.resolved).toBe(
      '/raw/tree/release%2Fv1.2/writing/pages.md'
    )
    expect(rewrite(routes, '/blob/a1b2c3d/getting-started/introduction')?.resolved).toBe(
      '/raw/blob/a1b2c3d/getting-started/introduction.md'
    )
  })

  it('never rewrites the mirrors, APIs, internals or dotted paths', () => {
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
      expect(rewrite(routes, path), path).toBeNull()
    }
  })
})
