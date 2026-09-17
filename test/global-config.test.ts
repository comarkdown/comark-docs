import { afterEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@vercel/global-config', () => ({ get }))

afterEach(() => {
  vi.unstubAllEnvs()
  get.mockReset()
})

describe('getPinnedSha', () => {
  it('returns undefined without reading the store when no Global Config is connected', async () => {
    vi.stubEnv('GLOBAL_CONFIG', '')
    const { getPinnedSha } = await import('../server/utils/global-config')

    await expect(getPinnedSha()).resolves.toBeUndefined()
    expect(get).not.toHaveBeenCalled()
  })

  it('returns the pinned SHA when the store has one', async () => {
    vi.stubEnv('GLOBAL_CONFIG', 'connection-string')
    get.mockResolvedValue('abc123')
    const { getPinnedSha } = await import('../server/utils/global-config')

    await expect(getPinnedSha()).resolves.toBe('abc123')
    expect(get).toHaveBeenCalledWith('contentSha')
  })

  it('returns undefined when the key is unset', async () => {
    vi.stubEnv('GLOBAL_CONFIG', 'connection-string')
    get.mockResolvedValue(undefined)
    const { getPinnedSha } = await import('../server/utils/global-config')

    await expect(getPinnedSha()).resolves.toBeUndefined()
  })

  it('falls back to undefined when the read fails', async () => {
    vi.stubEnv('GLOBAL_CONFIG', 'connection-string')
    get.mockRejectedValue(new Error('network error'))
    const { getPinnedSha } = await import('../server/utils/global-config')

    await expect(getPinnedSha()).resolves.toBeUndefined()
  })
})
