import { describe, expect, it } from 'vitest'
import { parseBranchName, parseCommitSha } from '../server/utils/refs'

/**
 * The public preview endpoints in one place.
 *
 * `/api/cms/blob/:sha` and `/api/cms/tree/:branch` are unauthenticated, and each
 * distinct ref they accept costs a preview-CMS instance and (for branches) a GitHub
 * API call. These assert the boundary those routes enforce, using the same inputs
 * that motivated adding it.
 */
describe('preview ref boundary', () => {
  const blobRoute = (sha: string) => parseCommitSha(sha)
  const treeRoute = (branch: string) => parseBranchName(decodeURIComponent(branch))

  it('accepts the refs the app itself generates', () => {
    // `VersionHistory.select` links to /blob/<full sha>; UI shortSha is 7 chars.
    expect(blobRoute('4f2a9c1e8b7d6a5f4e3c2b1a0f9e8d7c6b5a4938')).not.toBeNull()
    expect(blobRoute('4f2a9c1')).not.toBeNull()
    // `useCMS` encodes branch names into /api/cms/tree/<encoded>.
    expect(treeRoute(encodeURIComponent('feat/new-docs'))).toBe('feat/new-docs')
  })

  it('turns away refs that would each allocate a CMS instance', () => {
    for (const junk of ['', 'x', 'not-a-sha', '../../etc', 'HEAD', 'main']) {
      expect(blobRoute(junk)).toBeNull()
    }
  })

  it('turns away refs that would each cost a GitHub API call', () => {
    for (const junk of ['', '-c', '..', 'a/../../b', 'HEAD@{0}', 'x'.repeat(200)]) {
      expect(treeRoute(encodeURIComponent(junk))).toBeNull()
    }
  })

  it('collapses SHA casing so one commit cannot occupy two registry slots', () => {
    const sha = '4f2a9c1e8b7d6a5f4e3c2b1a0f9e8d7c6b5a4938'
    expect(blobRoute(sha.toUpperCase())).toBe(blobRoute(sha))
  })
})
