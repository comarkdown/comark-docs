import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveContentSha } from '../server/utils/github'

/** One commits-query response. `resolveContentSha` reads only `sha`. */
const commits = (sha: string) => new Response(JSON.stringify([{ sha }]), { status: 200 })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('resolveContentSha', () => {
  it('resolves the latest commit touching the configured content directory', async () => {
    const fetch = vi.fn().mockResolvedValue(commits('content-sha'))
    vi.stubGlobal('fetch', fetch)

    await expect(resolveContentSha('feat/docs', '/docs/content/')).resolves.toBe('content-sha')

    const requested = new URL(String(fetch.mock.calls[0]![0]))
    expect(requested.pathname).toBe('/repos/comarkdown/comark-docs/commits')
    expect(Object.fromEntries(requested.searchParams)).toEqual({
      sha: 'feat/docs',
      path: 'docs/content',
      per_page: '1',
    })
  })

  it('caches each branch and content directory independently', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(commits('docs-sha')).mockResolvedValueOnce(commits('api-sha'))
    vi.stubGlobal('fetch', fetch)

    await expect(resolveContentSha('test/cache-key', 'docs/content')).resolves.toBe('docs-sha')
    await expect(resolveContentSha('test/cache-key', 'docs/content')).resolves.toBe('docs-sha')
    await expect(resolveContentSha('test/cache-key', 'api/content')).resolves.toBe('api-sha')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('can refresh a cached content revision for the push webhook', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(commits('before')).mockResolvedValueOnce(commits('after'))
    vi.stubGlobal('fetch', fetch)

    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('before')
    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('before')
    await expect(resolveContentSha('test/refresh', 'docs/content', { refresh: true })).resolves.toBe('after')
    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('after')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})
