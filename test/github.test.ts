import { afterEach, describe, expect, it, vi } from 'vitest'
import { contentCacheBase } from '../server/utils/cache'
import { resolveContentSha } from '../server/utils/github'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('resolveContentSha', () => {
  it('resolves the latest commit touching the configured content directory', async () => {
    const fetch = vi.fn().mockResolvedValue([{ sha: 'content-sha' }])
    vi.stubGlobal('$fetch', fetch)

    await expect(resolveContentSha('feat/docs', '/docs/content/')).resolves.toBe('content-sha')
    expect(fetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/comarkdown/comark-docs/commits',
      expect.objectContaining({
        query: { sha: 'feat/docs', path: 'docs/content', per_page: 1 },
      })
    )
  })

  it('caches each branch and content directory independently', async () => {
    const fetch = vi.fn().mockResolvedValueOnce([{ sha: 'docs-sha' }]).mockResolvedValueOnce([{ sha: 'api-sha' }])
    vi.stubGlobal('$fetch', fetch)

    await expect(resolveContentSha('test/cache-key', 'docs/content')).resolves.toBe('docs-sha')
    await expect(resolveContentSha('test/cache-key', 'docs/content')).resolves.toBe('docs-sha')
    await expect(resolveContentSha('test/cache-key', 'api/content')).resolves.toBe('api-sha')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('can refresh a cached content revision for the push webhook', async () => {
    const fetch = vi.fn().mockResolvedValueOnce([{ sha: 'before' }]).mockResolvedValueOnce([{ sha: 'after' }])
    vi.stubGlobal('$fetch', fetch)

    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('before')
    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('before')
    await expect(resolveContentSha('test/refresh', 'docs/content', { refresh: true })).resolves.toBe('after')
    await expect(resolveContentSha('test/refresh', 'docs/content')).resolves.toBe('after')
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('contentCacheBase', () => {
  it('isolates parsed artifacts by deployment code revision', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'deployment-sha')
    expect(contentCacheBase('content-sha')).toBe('content:deployment-sha:content-sha')
  })

  it('falls back to the deployment id outside Git deployments', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '')
    vi.stubEnv('VERCEL_DEPLOYMENT_ID', 'deployment-id')
    expect(contentCacheBase('content-sha')).toBe('content:deployment-id:content-sha')
  })
})
