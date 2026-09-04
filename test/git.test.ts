import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getLastCommit, getTreeSha, hasParent, parseGitRemote } from '../utils/git'

describe('parseGitRemote', () => {
  it('parses SSH remotes', () => {
    expect(parseGitRemote('git@github.com:comarkdown/comark-docs.git')).toEqual({
      owner: 'comarkdown',
      name: 'comark-docs',
      url: 'https://github.com/comarkdown/comark-docs',
    })
  })

  it('parses HTTPS remotes, with and without .git', () => {
    expect(parseGitRemote('https://github.com/comarkdown/comark-docs.git')?.name).toBe('comark-docs')
    expect(parseGitRemote('https://github.com/comarkdown/comark-docs')?.name).toBe('comark-docs')
  })

  it('keeps a non-GitHub host', () => {
    expect(parseGitRemote('git@gitlab.com:group/project.git')?.url).toBe('https://gitlab.com/group/project')
  })

  it('trims surrounding whitespace from git output', () => {
    expect(parseGitRemote('  git@github.com:o/n.git\n')?.owner).toBe('o')
  })

  it('returns undefined for anything unrecognised', () => {
    expect(parseGitRemote('')).toBeUndefined()
    expect(parseGitRemote('not-a-remote')).toBeUndefined()
    expect(parseGitRemote('/local/path/repo')).toBeUndefined()
  })
})


describe('commit and tree helpers', () => {
  let repo: string

  const run = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' })
  const write = async (file: string, body: string) => {
    await mkdir(dirname(join(repo, file)), { recursive: true })
    await writeFile(join(repo, file), body, 'utf8')
  }

  beforeEach(async () => {
    repo = await mkdtemp(join(tmpdir(), 'comark-git-'))
    run('init', '-q', '-b', 'main')
    run('config', 'user.email', 'test@example.com')
    run('config', 'user.name', 'Test')

    await write('content/index.md', '# one\n')
    run('add', '-A')
    run('commit', '-qm', 'add content')

    // A later commit that leaves `content/` untouched, so HEAD is not the last content commit.
    await write('src/app.ts', 'export const a = 1\n')
    run('add', '-A')
    run('commit', '-qm', 'add code')
  })

  afterEach(async () => {
    await rm(repo, { recursive: true, force: true })
  })

  it('finds the last commit touching a directory, not HEAD', () => {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim()
    const last = getLastCommit(repo, 'content')

    expect(last).toMatch(/^[0-9a-f]{40}$/)
    expect(last).not.toBe(head)
  })

  it('returns the same tree for a ref whose content matches HEAD', () => {
    // The whole safety property of the build-time seed: the commit it is labelled with has to hold
    // the content that was parsed. Here the code commit did not touch `content/`, so both agree.
    const last = getLastCommit(repo, 'content')!
    expect(getTreeSha(repo, last, 'content')).toBe(getTreeSha(repo, 'HEAD', 'content'))
  })

  it('returns a different tree once the content changes', async () => {
    const before = getTreeSha(repo, 'HEAD', 'content')!

    await write('content/index.md', '# two\n')
    run('add', '-A')
    run('commit', '-qm', 'edit content')

    expect(getTreeSha(repo, 'HEAD', 'content')).not.toBe(before)
    // A stale label is what the seed must never be written under.
    expect(getTreeSha(repo, 'HEAD~1', 'content')).toBe(before)
  })

  it('returns undefined for a ref or path outside the checkout', () => {
    expect(getTreeSha(repo, 'HEAD', 'nope')).toBeUndefined()
    expect(getTreeSha(repo, 'a'.repeat(40), 'content')).toBeUndefined()
    expect(getLastCommit(repo, 'nope')).toBeUndefined()
  })

  it('reports a missing parent at the root commit', () => {
    const root = execFileSync('git', ['rev-list', '--max-parents=0', 'HEAD'], {
      cwd: repo,
      encoding: 'utf8',
    }).trim()

    expect(hasParent(repo, 'HEAD')).toBe(true)
    expect(hasParent(repo, root)).toBe(false)
  })
})
