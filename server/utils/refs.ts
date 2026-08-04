// `/tree/:branch`, `/blob/:sha` and their `/api/content/**` endpoints are public and unauthenticated,
// and what they receive becomes a preview-content registry key, a GitHub API ref and (in dev) a `git`
// argv entry — so an unvalidated ref is an allocation and an outbound call, not just a 404.

/** Longest ref we'll consider. Real branch names are far shorter. */
const MAX_REF_LENGTH = 128

/**
 * A commit SHA: 7–40 hex digits, lowercased so `/blob/ABC123` and `/blob/abc123` share one entry.
 */
export function parseCommitSha(value: string): string | null {
  const sha = value.trim().toLowerCase()
  return /^[0-9a-f]{7,40}$/.test(sha) ? sha : null
}

/**
 * A branch name: the `git check-ref-format` subset that can't read as a command-line option, a path
 * traversal or a revision expression. Deliberately narrower than git allows.
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

/** A repo-relative directory path (`examples/node`) that can't escape the dir it resolves against. */
export function parseRepoPath(value: string): string | null {
  const path = value.trim().replace(/^\/+|\/+$/g, '')
  if (!path || path.length > 512) return null
  if (path.includes('\\') || path.includes('\0')) return null
  if (path.split('/').some((segment) => segment === '..' || segment === '.')) return null
  return path
}
