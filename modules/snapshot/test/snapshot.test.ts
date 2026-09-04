import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSeedRefs } from '../utils'

const SHA = (char: string) => char.repeat(40)

describe('resolveSeedRefs', () => {
  let repo: string
  let contentCommit: string
  let head: string

  const run = (...args: string[]) =>
    execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

  const write = async (file: string, body: string) => {
    await mkdir(dirname(join(repo, file)), { recursive: true })
    await writeFile(join(repo, file), body, 'utf8')
  }

  /** Answers the commits query with `sha` per requested ref; `null` means 404. */
  function stubApi(bySha: Record<string, string | null>) {
    return vi.fn(async (url: string | URL) => {
      const ref = new URL(String(url)).searchParams.get('sha') ?? ''
      const answer = bySha[ref]
      if (answer === undefined || answer === null) return new Response('[]', { status: 404 })
      return new Response(JSON.stringify([{ sha: answer }]), { status: 200 })
    })
  }

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'comark-seedrefs-'))
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 'test@example.com')
    run('config', 'user.name', 'Test')

    await write('content/index.md', '# one\n')
    run('add', '-A')
    run('commit', '-qm', 'add content')
    contentCommit = run('rev-parse', 'HEAD')

    // A later commit that leaves `content/` alone, so HEAD is not the last content commit.
    await write('src/app.ts', 'export const a = 1\n')
    run('add', '-A')
    run('commit', '-qm', 'add code')
    head = run('rev-parse', 'HEAD')
  })

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true })
    vi.unstubAllGlobals()
  })

  const input = () => ({ repoRoot: repo, contentDir: 'content', repo: 'owner/name', token: 'tok' })

  it('walks from the built commit, not the branch', async () => {
    // The distinction that keeps a mid-build push (or a redeploy of an older commit) from labelling
    // the seed with content it does not hold.
    const fetchMock = stubApi({ [head]: contentCommit, main: SHA('f') })
    vi.stubGlobal('fetch', fetchMock)

    expect(await resolveSeedRefs(input())).toEqual([contentCommit])

    const requested = new URL(String(fetchMock.mock.calls[0]![0])).searchParams
    expect(requested.get('sha')).toBe(head)
    expect(requested.get('path')).toBe('content')
    expect(requested.get('per_page')).toBe('1')
  })

  it('adds the pin when it resolves to the same content commit', async () => {
    const pinnedSha = SHA('a')
    vi.stubGlobal('fetch', stubApi({ [head]: contentCommit, [pinnedSha]: contentCommit }))

    expect(await resolveSeedRefs({ ...input(), pinnedSha })).toEqual([contentCommit, pinnedSha])
  })

  it('drops a pin that resolves elsewhere', async () => {
    // A pin on older content: the seed holds this build's content, so it must not be labelled with it.
    const pinnedSha = SHA('a')
    vi.stubGlobal('fetch', stubApi({ [head]: contentCommit, [pinnedSha]: SHA('b') }))

    expect(await resolveSeedRefs({ ...input(), pinnedSha })).toEqual([contentCommit])
  })

  it('falls back to a tree-verified git answer when the API fails', async () => {
    vi.stubGlobal('fetch', stubApi({}))

    // Full history here, so git finds the true commit and its content tree matches HEAD's.
    expect(await resolveSeedRefs(input())).toEqual([contentCommit])
  })

  it('ships nothing when neither the API nor git can name the content', async () => {
    vi.stubGlobal('fetch', stubApi({}))

    expect(await resolveSeedRefs({ ...input(), contentDir: 'nope' })).toEqual([])
  })

  it('warns on the git fallback when the answer is a shallow boundary', async () => {
    vi.stubGlobal('fetch', stubApi({}))
    const warn = vi.fn()

    // A one-commit repo: its only commit is parentless, which is what a depth-1 clone looks like.
    const shallow = await mkdtemp(join(tmpdir(), 'comark-shallow-'))
    try {
      const at = (...args: string[]) => execFileSync('git', args, { cwd: shallow, stdio: 'ignore' })
      at('init', '-q', '-b', 'main')
      at('config', 'user.email', 'test@example.com')
      at('config', 'user.name', 'Test')
      await mkdir(join(shallow, 'content'), { recursive: true })
      await writeFile(join(shallow, 'content/index.md'), '# one\n', 'utf8')
      at('add', '-A')
      at('commit', '-qm', 'init')

      const refs = await resolveSeedRefs({ ...input(), repoRoot: shallow, warn })
      expect(refs).toHaveLength(1)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('shallow clone boundary')
    } finally {
      await rm(shallow, { recursive: true, force: true })
    }
  })
})
