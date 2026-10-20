import { describe, expect, it } from 'vitest'
import { baseURL, fetchPath, fetchWithFailure, INTRO_PAGE, NOT_FOUND_SLUG, SITE_URL } from './utils'

/** Absolute URLs point at the production site: keep the path and query only. */
function toPath(url: string): string {
  // Resolved against `baseURL` so a relative `<loc>` fails its own test, not the file import.
  const { pathname, search } = new URL(url.replaceAll('&amp;', '&'), baseURL)
  return pathname + search
}

// The sitemap lists every content page plus the Vue pages, so a new page is covered without touching this file.
const sitemap = await fetchPath('/sitemap.xml').then((res) => res.text())
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!)
const pages = locs.map(toPath)

describe('pages', () => {
  it('lists the landing page and the docs', () => {
    expect(pages).toContain('/')
    expect(pages.length).toBeGreaterThan(5)
  })

  // The sitemap protocol requires absolute URLs, on the canonical origin rather than the serving host.
  it('lists absolute URLs on the site origin', () => {
    const offsite = locs.filter((loc) => !loc.startsWith(`${SITE_URL}/`))
    expect(offsite).toEqual([])
  })

  // `accept` is explicit: a bare `*/*` gets the JSON error, or the markdown 404 meant for agents.
  it.each([
    [`/${NOT_FOUND_SLUG}`, 'text/html'],
    [`/getting-started/${NOT_FOUND_SLUG}`, 'text/html'],
    [`/raw/${NOT_FOUND_SLUG}.md`, 'text/markdown'],
  ])('%s returns a %s 404', async (path, type) => {
    const response = await fetchPath(path, { accept: type })
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain(type)
  })

  it.each(pages)('%s renders, OG image included', async (path) => {
    const { response, failure } = await fetchWithFailure(path)
    expect(response.status, failure).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const ogImage = (await response.text()).match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    if (ogImage) {
      const og = await fetchWithFailure(toPath(ogImage))
      expect(og.response.status, og.failure).toBe(200)
      expect(og.response.headers.get('content-type')).toBe('image/png')
    }
  })
})

describe('agent routes', () => {
  it.each([
    '/raw/index.md',
    `/raw${INTRO_PAGE.path}.md`,
    '/llms.txt',
    '/llms-full.txt',
    '/sitemap.md',
    '/rss.xml',
    '/openapi.json',
    '/robots.txt',
  ])('%s responds', async (path) => {
    const { response, failure } = await fetchWithFailure(path)
    expect(response.status, failure).toBe(200)
  })

  // Cached routes answer with a redirect to the `/raw` twin rather than a rewrite.
  it('negotiates markdown on a page URL', async () => {
    const { response, failure } = await fetchWithFailure(INTRO_PAGE.path, { accept: 'text/markdown' })
    expect(response.status, failure).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
  })
})
