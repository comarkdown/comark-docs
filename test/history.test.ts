import { describe, expect, it } from 'vitest'
import { withCurrentVersion, type PageCommit } from '../server/utils/github'

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
