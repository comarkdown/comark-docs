import { describe, expect, it } from 'vitest'
import { parseBranchName, parseCommitSha, parseRef, parseRepoPath } from '../server/utils/refs'

describe('parseCommitSha', () => {
  it('accepts short and full SHAs', () => {
    expect(parseCommitSha('a1b2c3d')).toBe('a1b2c3d')
    expect(parseCommitSha('0'.repeat(40))).toBe('0'.repeat(40))
  })

  it('normalises case so one commit is one cache entry', () => {
    expect(parseCommitSha('ABCDEF1')).toBe('abcdef1')
  })

  it('rejects anything that is not hex of the right length', () => {
    expect(parseCommitSha('a1b2c3')).toBeNull() // too short
    expect(parseCommitSha('a'.repeat(41))).toBeNull() // too long
    expect(parseCommitSha('g1b2c3d')).toBeNull() // not hex
    expect(parseCommitSha('main')).toBeNull()
    expect(parseCommitSha('')).toBeNull()
  })
})

describe('parseBranchName', () => {
  it('accepts ordinary branch names', () => {
    expect(parseBranchName('main')).toBe('main')
    expect(parseBranchName('feat/add-thing')).toBe('feat/add-thing')
    expect(parseBranchName('release/v1.2.3')).toBe('release/v1.2.3')
    expect(parseBranchName('user.name/fix_1')).toBe('user.name/fix_1')
  })

  it('rejects refs that git would read as an option', () => {
    // `git ls-tree -r --name-only --output=x` — an argv entry, not a revision.
    expect(parseBranchName('--output=/tmp/x')).toBeNull()
    expect(parseBranchName('-c')).toBeNull()
  })

  it('rejects traversal and revision expressions', () => {
    expect(parseBranchName('../../etc/passwd')).toBeNull()
    expect(parseBranchName('main..dev')).toBeNull()
    expect(parseBranchName('main~1')).toBeNull()
    expect(parseBranchName('main^')).toBeNull()
    expect(parseBranchName('HEAD@{1}')).toBeNull()
    expect(parseBranchName('refs/heads/main:x')).toBeNull()
  })

  it('rejects git-invalid shapes', () => {
    expect(parseBranchName('.hidden')).toBeNull()
    expect(parseBranchName('feat/')).toBeNull()
    expect(parseBranchName('main.lock')).toBeNull()
    expect(parseBranchName('')).toBeNull()
    expect(parseBranchName('   ')).toBeNull()
  })

  it('bounds length so a ref cannot be used as a payload', () => {
    expect(parseBranchName('a'.repeat(128))).toBe('a'.repeat(128))
    expect(parseBranchName('a'.repeat(129))).toBeNull()
  })
})

describe('parseRef', () => {
  it('accepts either form', () => {
    expect(parseRef('a1b2c3d')).toBe('a1b2c3d')
    expect(parseRef('feat/x')).toBe('feat/x')
    expect(parseRef('-c')).toBeNull()
  })

  it('prefers the SHA reading, normalising case', () => {
    // `ABCDEF1` is a valid branch name too, but as a SHA it must lowercase so
    // `/blob/ABCDEF1` and `/blob/abcdef1` share a cache entry.
    expect(parseRef('ABCDEF1')).toBe('abcdef1')
  })
})

describe('parseRepoPath', () => {
  it('accepts and trims repo-relative paths', () => {
    expect(parseRepoPath('examples/node')).toBe('examples/node')
    expect(parseRepoPath('/examples/node/')).toBe('examples/node')
  })

  it('rejects traversal', () => {
    expect(parseRepoPath('../../../etc')).toBeNull()
    expect(parseRepoPath('examples/../../secret')).toBeNull()
    expect(parseRepoPath('examples/./node')).toBeNull()
  })

  it('rejects backslashes and NUL', () => {
    expect(parseRepoPath('examples\\node')).toBeNull()
    expect(parseRepoPath('examples\0/node')).toBeNull()
  })

  it('rejects empty and over-long paths', () => {
    expect(parseRepoPath('')).toBeNull()
    expect(parseRepoPath('/')).toBeNull()
    expect(parseRepoPath('a'.repeat(513))).toBeNull()
  })
})
