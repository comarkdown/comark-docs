import { describe, expect, it } from 'vitest'
import { withBranchOnly, withCurrentVersion, withMainLatest } from '../server/utils/history'
import type { PageCommit } from '../shared/types/history'

const commit = (sha: string): PageCommit => ({ sha, shortSha: sha.slice(0, 7), message: sha })

describe('withCurrentVersion', () => {
  it('flags the newest commit as current', () => {
    const result = withCurrentVersion([commit('aaa'), commit('bbb')])
    expect(result[0]).toMatchObject({ sha: 'aaa', current: true })
    expect(result[1].current).toBeUndefined()
  })

  it('returns an empty list untouched', () => {
    expect(withCurrentVersion([])).toEqual([])
  })

  it('never surfaces a commit that did not touch the page', () => {
    // Regression: the old `withProductionHead` injected the repo-wide head commit into every
    // page's history regardless of path, so an unrelated commit could outrank the page's own.
    const pageHistory = [commit('own-latest'), commit('own-older')]
    const result = withCurrentVersion(pageHistory)
    expect(result.map((c) => c.sha)).toEqual(['own-latest', 'own-older'])
  })
})

describe('withBranchOnly', () => {
  it('leaves commits present on the default branch unflagged', () => {
    const result = withBranchOnly([commit('shared')], new Set(['shared']))
    expect(result[0]?.branchOnly).toBeUndefined()
  })

  it('flags commits absent from the default branch', () => {
    const result = withBranchOnly([commit('feature-only'), commit('shared')], new Set(['shared']))
    expect(result[0]).toMatchObject({ sha: 'feature-only', branchOnly: true })
    expect(result[1]?.branchOnly).toBeUndefined()
  })

  it('flags every commit when the path does not exist yet on the default branch', () => {
    // Not the same as an empty list of commits: an empty *default-branch* set is a real case
    // (a file added only on this branch), and every commit shown must then be branch-only.
    const result = withBranchOnly([commit('new-file')], new Set())
    expect(result[0]).toMatchObject({ sha: 'new-file', branchOnly: true })
  })
})

describe('withMainLatest', () => {
  it('flags the commit matching the default branch\'s newest sha', () => {
    const result = withMainLatest([commit('newer'), commit('older')], 'older')
    expect(result[0]?.mainLatest).toBeUndefined()
    expect(result[1]).toMatchObject({ sha: 'older', mainLatest: true })
  })

  it('leaves commits untouched when unresolved', () => {
    expect(withMainLatest([commit('aaa')], undefined)[0]?.mainLatest).toBeUndefined()
  })

  it('no-ops when the sha is not in the list (stale branch)', () => {
    // The default branch moved past what this branch's history for the page reaches.
    const result = withMainLatest([commit('aaa'), commit('bbb')], 'not-in-list')
    expect(result.some((c) => c.mainLatest)).toBe(false)
  })
})
