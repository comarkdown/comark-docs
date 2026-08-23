import { afterEach, describe, expect, it, vi } from 'vitest'
import { authorizePreviewSha, resolvePullPreviewSha } from '../server/utils/github'

/**
 * GitHub shares git objects across the fork network: once a fork opens a PR against the content repo,
 * its head commit is fetchable through the *upstream* repo API — so `/blob/:sha` rendering any
 * well-formed SHA would render any fork's markdown on this domain. These tests pin the authorization
 * rule: same-repo PRs and upstream-history commits pass, fork PRs only with the `preview:enabled` label.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

const REPO = 'comarkdown/comark-docs'

interface MockRoutes {
  /** `commits/:sha` lookup result (also resolves short SHAs). */
  commit?: { sha: string } | Error
  /** `commits/:sha/pulls` result. */
  pulls?: Array<{ number: number; head?: { sha?: string; repo?: { full_name?: string } | null }; labels?: Array<{ name?: string }> }> | Error
  /** `compare/:base...:sha` result. */
  compare?: { status: string } | Error
  /** `pulls/:number` result. */
  pull?: { number: number; head?: { sha?: string; repo?: { full_name?: string } | null }; labels?: Array<{ name?: string }> } | Error
}

function notFound(): Error {
  const error = new Error('Not Found') as Error & { statusCode: number }
  error.statusCode = 404
  return error
}

/** Stub `$fetch` with a URL-dispatched GitHub API. Returns the mock to assert on calls. */
function stubGitHub(routes: MockRoutes) {
  const fetch = vi.fn(async (url: string) => {
    const respond = (result: unknown) => {
      if (result instanceof Error) throw result
      if (result === undefined) throw new Error(`Unmocked GitHub call: ${url}`)
      return result
    }
    if (url.includes('/compare/')) return respond(routes.compare)
    if (/\/commits\/[^/]+\/pulls$/.test(url)) return respond(routes.pulls)
    if (url.includes(`/repos/${REPO}/commits/`)) return respond(routes.commit)
    if (url.includes(`/repos/${REPO}/pulls/`)) return respond(routes.pull)
    throw new Error(`Unmocked GitHub call: ${url}`)
  })
  vi.stubGlobal('$fetch', fetch)
  return fetch
}

// The decision cache is module-level and shared across tests: every test uses its own SHA/PR number.
let unique = 0
function sha(): string {
  return `${(unique++).toString(16).padStart(4, '0')}a9c1e8b7d6a5f4e3c2b1a0f9e8d7c6b5a4938`.slice(0, 40)
}

describe('authorizePreviewSha', () => {
  it('allows a commit vouched for by a same-repo PR', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [{ number: 1, head: { sha: commit, repo: { full_name: REPO } } }],
    })
    await expect(authorizePreviewSha(commit)).resolves.toBe(commit)
  })

  it('rejects a fork PR commit without the preview label', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [{ number: 2, head: { sha: commit, repo: { full_name: 'attacker/comark-docs' } }, labels: [] }],
      compare: { status: 'diverged' },
    })
    await expect(authorizePreviewSha(commit)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('allows a fork PR commit once a maintainer adds the preview label', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [
        {
          number: 3,
          head: { sha: commit, repo: { full_name: 'contributor/comark-docs' } },
          labels: [{ name: 'preview:enabled' }],
        },
      ],
    })
    await expect(authorizePreviewSha(commit)).resolves.toBe(commit)
  })

  it('allows a commit in the production branch history (version-history links)', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [],
      compare: { status: 'behind' },
    })
    await expect(authorizePreviewSha(commit)).resolves.toBe(commit)
  })

  it('rejects a commit outside upstream history with no vouching PR', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [],
      compare: notFound(),
    })
    await expect(authorizePreviewSha(commit)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('rejects an unknown commit without further API calls', async () => {
    const commit = sha()
    const fetch = stubGitHub({ commit: notFound() })
    await expect(authorizePreviewSha(commit)).rejects.toMatchObject({ statusCode: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('resolves short SHAs to the full commit, so one commit pins one content instance', async () => {
    const commit = sha()
    stubGitHub({
      commit: { sha: commit },
      pulls: [{ number: 4, head: { sha: commit, repo: { full_name: REPO } } }],
    })
    await expect(authorizePreviewSha(commit.slice(0, 7))).resolves.toBe(commit)
  })

  it('caches denials so repeated probes cost no GitHub calls', async () => {
    const commit = sha()
    const fetch = stubGitHub({ commit: notFound() })
    await expect(authorizePreviewSha(commit)).rejects.toMatchObject({ statusCode: 404 })
    await expect(authorizePreviewSha(commit)).rejects.toMatchObject({ statusCode: 404 })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('does not cache retryable failures (rate limits, 5xx)', async () => {
    const commit = sha()
    const rateLimited = new Error('rate limited') as Error & { statusCode: number }
    rateLimited.statusCode = 403
    const fetch = stubGitHub({ commit: rateLimited })
    await expect(authorizePreviewSha(commit)).rejects.toThrow('rate limited')

    stubGitHub({
      commit: { sha: commit },
      pulls: [{ number: 5, head: { sha: commit, repo: { full_name: REPO } } }],
    })
    await expect(authorizePreviewSha(commit)).resolves.toBe(commit)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('resolvePullPreviewSha', () => {
  let prNumber = 1000

  it('resolves a same-repo PR to its head commit', async () => {
    const commit = sha()
    const number = prNumber++
    stubGitHub({ pull: { number, head: { sha: commit, repo: { full_name: REPO } } } })
    await expect(resolvePullPreviewSha(number)).resolves.toBe(commit)
  })

  it('rejects a fork PR without the preview label', async () => {
    const number = prNumber++
    stubGitHub({
      pull: { number, head: { sha: sha(), repo: { full_name: 'attacker/comark-docs' } }, labels: [] },
    })
    await expect(resolvePullPreviewSha(number)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('resolves a fork PR once it carries the preview label', async () => {
    const commit = sha()
    const number = prNumber++
    stubGitHub({
      pull: {
        number,
        head: { sha: commit, repo: { full_name: 'contributor/comark-docs' } },
        labels: [{ name: 'preview:enabled' }],
      },
    })
    await expect(resolvePullPreviewSha(number)).resolves.toBe(commit)
  })

  it('rejects an unknown PR number', async () => {
    const number = prNumber++
    stubGitHub({ pull: notFound() })
    await expect(resolvePullPreviewSha(number)).rejects.toMatchObject({ statusCode: 404 })
  })
})
