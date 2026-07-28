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

/**
 * The tree route's basePath has to come out encoded exactly once.
 *
 * The client sends an encoded branch, `getRouterParam` does not decode, and the CMS
 * handler strips `basePath` from the request URL as a literal prefix — so encoding
 * the raw param again yields `feat%252Fx`, which never matches the `feat%2Fx` in the
 * URL and silently breaks previews for any branch containing a slash. Upstream hit
 * exactly this (comark-cms#84).
 */
describe('tree route basePath encoding', () => {
  // What app/composables/useCMS.ts builds: Vue Router params are decoded, so it
  // encodes once.
  const clientBasePath = (branch: string) => `/api/cms/tree/${encodeURIComponent(branch)}`
  // What the server route builds from the raw (still-encoded) router param.
  const serverBasePath = (rawParam: string) =>
    `/api/cms/tree/${encodeURIComponent(parseBranchName(decodeURIComponent(rawParam))!)}`

  it('agrees with the client for a slashed branch', () => {
    const branch = 'feat/new-docs'
    const raw = encodeURIComponent(branch)
    expect(serverBasePath(raw)).toBe(clientBasePath(branch))
    expect(serverBasePath(raw)).toBe('/api/cms/tree/feat%2Fnew-docs')
  })

  it('does not double-encode', () => {
    expect(serverBasePath(encodeURIComponent('feat/x'))).not.toContain('%252F')
  })

  it('agrees for plain branch names too', () => {
    expect(serverBasePath('main')).toBe(clientBasePath('main'))
  })
})
