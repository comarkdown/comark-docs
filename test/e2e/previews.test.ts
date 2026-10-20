import { describe, expect, it } from 'vitest'
import { fetchPath, fetchWithFailure, INTRO_PAGE, NOT_FOUND_SLUG } from './utils'

// The content commit production serves, resolved from the commit under test in CI (`NUXT_DOCS_GITHUB_BRANCH`).
const head = await fetchWithFailure('/api/content/head')
const { sha } = head.response.ok ? ((await head.response.json()) as { sha: string }) : { sha: undefined }

describe('versioned previews', () => {
  it('resolves the production content commit', () => {
    expect(head.response.status, head.failure).toBe(200)
    expect(sha).toMatch(/^[0-9a-f]{40}$/)
  })

  it.each([
    `/blob/${sha}${INTRO_PAGE.path}`,
    `/tree/main${INTRO_PAGE.path}`,
  ])('%s renders, kept out of search engines', async (path) => {
    const { response, failure } = await fetchWithFailure(path)
    expect(response.status, failure).toBe(200)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await response.text()).toContain(`<title>${INTRO_PAGE.title} |`)
  })

  // The page sets the same header, so only a response it does not render pins the route rules.
  // An unknown commit must 404, not 500: GitHub answers its lookup with a 422.
  it.each([
    `/blob/${'0'.repeat(40)}${INTRO_PAGE.path}`,
    `/tree/main/${NOT_FOUND_SLUG}`,
  ])('%s returns a 404, kept out of search engines', async (path) => {
    const response = await fetchPath(path, { accept: 'text/html' })
    expect(response.status).toBe(404)
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})
