import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveSnapshotSha } from '../utils'

const SHA = (char: string) => char.repeat(40)

describe('resolveSnapshotSha', () => {
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
    repo = await mkdtemp(join(tmpdir(), 'comark-snapshot-sha-'))
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
    // the snapshot with content it does not hold.
    const fetchMock = stubApi({ [head]: contentCommit, main: SHA('f') })
    vi.stubGlobal('fetch', fetchMock)

    expect(await resolveSnapshotSha(input())).toBe(contentCommit)

    const requested = new URL(String(fetchMock.mock.calls[0]![0])).searchParams
    expect(requested.get('sha')).toBe(head)
    expect(requested.get('path')).toBe('content')
    expect(requested.get('per_page')).toBe('1')
  })

  it('falls back to a tree-verified git answer when the API fails', async () => {
    vi.stubGlobal('fetch', stubApi({}))

    // Full history here, so git finds the true commit and its content tree matches HEAD's.
    expect(await resolveSnapshotSha(input())).toBe(contentCommit)
  })

  it('skips the API when no repository is known', async () => {
    const fetchMock = stubApi({ [head]: SHA('c') })
    vi.stubGlobal('fetch', fetchMock)

    expect(await resolveSnapshotSha({ ...input(), repo: '' })).toBe(contentCommit)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ships nothing when neither the API nor git can name the content', async () => {
    vi.stubGlobal('fetch', stubApi({}))

    expect(await resolveSnapshotSha({ ...input(), contentDir: 'nope' })).toBeUndefined()
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

      expect(await resolveSnapshotSha({ ...input(), repoRoot: shallow, warn })).toMatch(/^[0-9a-f]{40}$/)
      expect(warn).toHaveBeenCalledOnce()
      expect(warn.mock.calls[0]![0]).toContain('shallow clone boundary')
    } finally {
      await rm(shallow, { recursive: true, force: true })
    }
  })
})
