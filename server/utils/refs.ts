/**
 * Validation for the git refs that arrive from the URL.
 *
 * `/tree/:branch` and `/blob/:sha` (and their `/api/cms/**` data endpoints) are
 * public and unauthenticated, and whatever they receive is used three ways: as a
 * key in the preview-CMS registry, as a GitHub API ref, and — in development —
 * as an argument to `git`. An unvalidated ref therefore isn't just a 404: it's an
 * allocation, an outbound API call, and an argv entry. Reject early instead.
 */

/** Longest ref we'll consider. Real branch names are far shorter. */
const MAX_REF_LENGTH = 128

/**
 * A commit SHA: 7–40 lowercase hex digits (`git rev-parse --short` output through
 * the full object name). Returned normalised so `/blob/ABC123` and `/blob/abc123`
 * share one cache entry instead of two.
 */
export function parseCommitSha(value: string): string | null {
  const sha = value.trim().toLowerCase()
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null
}

/**
 * A branch name, conservatively: the subset of `git check-ref-format` that can't
 * be mistaken for a command-line option, a path traversal, or a revision
 * expression. Deliberately narrower than git allows — no `~`, `^`, `:`, `?`, `*`,
 * `[`, `\`, no leading `-` or `.`, no `..`, no `@{`, no trailing `/` or `.lock`.
 */
export function parseBranchName(value: string): string | null {
  const branch = value.trim()
  if (!branch || branch.length > MAX_REF_LENGTH) return null
  if (!/^[\w.][\w./+-]*$/.test(branch)) return null
  if (branch.startsWith('-') || branch.startsWith('.')) return null
  if (branch.includes('..') || branch.includes('@{')) return null
  if (branch.endsWith('/') || branch.endsWith('.lock')) return null
  return branch
}

/** Either a commit SHA or a branch name — whichever the value looks like. */
export function parseRef(value: string): string | null {
  return parseCommitSha(value) ?? parseBranchName(value)
}

/**
 * A repo-relative directory path (`examples/node`), rejecting anything that
 * could escape the directory it's resolved against: absolute paths, `..`
 * segments, backslashes, NUL bytes.
 */
export function parseRepoPath(value: string): string | null {
  const path = value.trim().replace(/^\/+|\/+$/g, '')
  if (!path || path.length > 512) return null
  if (path.includes('\\') || path.includes('\0')) return null
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) return null
  return path
}
