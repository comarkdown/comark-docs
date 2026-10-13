import { describe, expect, inject, it } from 'vitest'

const baseURL = inject('baseURL')

/** Fetches a site path, explaining a failure with the message Nitro attaches to its JSON errors. */
async function get(path: string, headers?: HeadersInit) {
  const response = await fetch(new URL(path, baseURL), { headers })
  let failure = `${path} returned ${response.status}`
  if (response.status >= 400) {
    const error = await fetch(new URL(path, baseURL), { headers: { accept: 'application/json' } })
      .then((res) => res.json() as Promise<{ message?: string }>)
      .catch(() => undefined)
    if (error?.message) failure += `: ${error.message}`
  }
  return { response, failure }
}

/** Absolute URLs point at the production site: keep the path and query only. */
function toPath(url: string): string {
  const { pathname, search } = new URL(url.replaceAll('&amp;', '&'))
  return pathname + search
}

// The sitemap lists every content page plus the Vue pages, so a new page is covered without touching this file.
const sitemap = await fetch(new URL('/sitemap.xml', baseURL)).then((res) => res.text())
const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => toPath(match[1]!))

describe('pages', () => {
  it('lists the landing page and the docs', () => {
    expect(pages).toContain('/')
    expect(pages.length).toBeGreaterThan(5)
  })

  it.each(pages)('%s renders, OG image included', async (path) => {
    const { response, failure } = await get(path)
    expect(response.status, failure).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/html')

    const ogImage = (await response.text()).match(/<meta property="og:image" content="([^"]+)"/)?.[1]
    if (ogImage) {
      const og = await get(toPath(ogImage))
      expect(og.response.status, og.failure).toBe(200)
      expect(og.response.headers.get('content-type')).toBe('image/png')
    }
  })
})

describe('agent routes', () => {
  it.each([
    '/raw/index.md',
    '/raw/getting-started/introduction.md',
    '/llms.txt',
    '/llms-full.txt',
    '/sitemap.md',
    '/rss.xml',
    '/openapi.json',
    '/robots.txt',
  ])('%s responds', async (path) => {
    const { response, failure } = await get(path)
    expect(response.status, failure).toBe(200)
  })

  // Cached routes answer with a redirect to the `/raw` twin rather than a rewrite.
  it('negotiates markdown on a page URL', async () => {
    const { response, failure } = await get('/getting-started/introduction', { accept: 'text/markdown' })
    expect(response.status, failure).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/markdown')
  })
})
