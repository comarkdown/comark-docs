import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `resolveProdSha` calls `getPinnedSha`, `targetBranch` and `resolveContentSha` as Nitro
// auto-imports (no explicit import in `content.ts`), so they're stubbed as globals here.
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('resolveProdSha', () => {
  it('shares the in-flight resolution across concurrent callers', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    let pinCalls = 0
    let shaCalls = 0
    vi.stubGlobal('getPinnedSha', async () => {
      pinCalls++
      await Promise.resolve() // force a tick so both calls land inside the same in-flight promise
      return undefined
    })
    vi.stubGlobal('targetBranch', () => 'main')
    vi.stubGlobal('resolveContentSha', async () => {
      shaCalls++
      return 'sha-1'
    })

    const { resolveProdSha } = await import('../server/utils/content')

    const [a, b] = await Promise.all([resolveProdSha(), resolveProdSha()])

    expect(a).toBe('sha-1')
    expect(b).toBe('sha-1')
    expect(pinCalls).toBe(1)
    expect(shaCalls).toBe(1)
  })

  it('resolves again once the in-flight promise has settled, so head can still advance', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview') // skips the pinned-config lookup, isolating resolveContentSha
    const shas = ['sha-1', 'sha-2']
    vi.stubGlobal('targetBranch', () => 'main')
    vi.stubGlobal('resolveContentSha', async () => shas.shift())

    const { resolveProdSha } = await import('../server/utils/content')

    await expect(resolveProdSha()).resolves.toBe('sha-1')
    await expect(resolveProdSha()).resolves.toBe('sha-2')
  })

  it('lets a failed resolution be retried instead of caching the rejection', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubGlobal('targetBranch', () => 'main')
    const resolveContentSha = vi.fn().mockRejectedValueOnce(new Error('rate limited')).mockResolvedValueOnce('sha-1')
    vi.stubGlobal('resolveContentSha', resolveContentSha)

    const { resolveProdSha } = await import('../server/utils/content')

    await expect(resolveProdSha()).rejects.toThrow('rate limited')
    await expect(resolveProdSha()).resolves.toBe('sha-1')
    expect(resolveContentSha).toHaveBeenCalledTimes(2)
  })
})
