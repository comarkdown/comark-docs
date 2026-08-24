import { describe, expect, it } from 'vitest'
import { parseBranchName, parseCommitSha, parsePullNumber } from '../server/utils/refs'

/**
 * `/api/content/blob/:sha` and `/api/content/tree/:branch` are unauthenticated, and each distinct ref they accept costs
 * a preview-content instance and (for branches) a GitHub API call. These guard that boundary.
 */
describe('preview ref boundary', () => {
  const blobRoute = (sha: string) => parseCommitSha(sha)
  const treeRoute = (branch: string) => parseBranchName(decodeURIComponent(branch))

  it('accepts the refs the app itself generates', () => {
    // `VersionHistory.select` links to /blob/<full sha>; UI shortSha is 7 chars.
    expect(blobRoute('4f2a9c1e8b7d6a5f4e3c2b1a0f9e8d7c6b5a4938')).not.toBeNull()
    expect(blobRoute('4f2a9c1')).not.toBeNull()
    // `useDocsContent` encodes branch names into /api/content/tree/<encoded>.
    expect(treeRoute(encodeURIComponent('feat/new-docs'))).toBe('feat/new-docs')
  })

  it('turns away refs that would each allocate a content instance', () => {
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

  // GitHub resolves `pull/<n>/head` and `refs/...` wherever a branch is accepted, which would let a
  // fork PR's commits through `/tree/` without the label check `/pr/:number` enforces.
  it('turns away the hidden pull/refs ref namespaces', () => {
    for (const ref of ['pull/123/head', 'pull/123/merge', 'refs/pull/123/head', 'refs/heads/main']) {
      expect(treeRoute(encodeURIComponent(ref))).toBeNull()
    }
    // A branch merely *containing* these words is still fine.
    expect(treeRoute(encodeURIComponent('feat/pull-based-sync'))).toBe('feat/pull-based-sync')
  })
})

/** `/api/content/pr/:number` is public too: only plausible PR numbers may reach the GitHub API. */
describe('pr number boundary', () => {
  it('accepts plausible PR numbers', () => {
    expect(parsePullNumber('1')).toBe(1)
    expect(parsePullNumber('4823')).toBe(4823)
  })

  it('turns away everything else', () => {
    for (const junk of ['', '0', '007', '-1', '1.5', '1e3', 'abc', '12345678901', '123abc']) {
      expect(parsePullNumber(junk)).toBeNull()
    }
  })
})

/**
 * basePath must come out encoded exactly once: the client sends an encoded branch, `getRouterParam` does not
 * decode, and the content handler strips `basePath` as a literal prefix — so re-encoding yields `feat%252Fx`, which
 * never matches and silently breaks previews for slashed branches. Upstream hit exactly this (comark-content#84).
 */
describe('tree route basePath encoding', () => {
  // What app/composables/useDocsContent.ts builds: Vue Router params are decoded, so it encodes once.
  const clientBasePath = (branch: string) => `/api/content/tree/${encodeURIComponent(branch)}`
  // What the server route builds from the raw (still-encoded) router param.
  const serverBasePath = (rawParam: string) =>
    `/api/content/tree/${encodeURIComponent(parseBranchName(decodeURIComponent(rawParam))!)}`

  it('agrees with the client for a slashed branch', () => {
    const branch = 'feat/new-docs'
    const raw = encodeURIComponent(branch)
    expect(serverBasePath(raw)).toBe(clientBasePath(branch))
    expect(serverBasePath(raw)).toBe('/api/content/tree/feat%2Fnew-docs')
  })

  it('does not double-encode', () => {
    expect(serverBasePath(encodeURIComponent('feat/x'))).not.toContain('%252F')
  })

  it('agrees for plain branch names too', () => {
    expect(serverBasePath('main')).toBe(clientBasePath('main'))
  })
})
