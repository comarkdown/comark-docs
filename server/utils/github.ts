import { createHash, timingSafeEqual } from 'node:crypto'
import { createStorage } from 'unstorage'

export interface GitHubCommit {
  added?: string[]
  removed?: string[]
  modified?: string[]
}

export interface GitHubPushPayload {
  ref?: string
  /** Parent SHA of the ref before this push */
  before?: string
  commits?: GitHubCommit[]
  head_commit?: GitHubCommit & { id?: string }
}

/** Constant-time string comparison. */
export function safeCompare(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

export function githubRepo(): string {
  const { docs } = useRuntimeConfig()
  const owner = docs.github.owner || process.env.VERCEL_GIT_REPO_OWNER
  const slug = docs.github.repo || process.env.VERCEL_GIT_REPO_SLUG
  if (!owner || !slug) {
    throw new Error(
      'The content repository is not configured: set `comarkDocs.github` / NUXT_DOCS_GITHUB_OWNER + NUXT_DOCS_GITHUB_REPO (auto-inferred from git and on Vercel Git-connected deployments)'
    )
  }
  return `${owner}/${slug}`
}

export function githubToken(): string | undefined {
  const { docs } = useRuntimeConfig()
  return docs.githubToken || process.env.GITHUB_TOKEN || undefined
}

/** Production branch, resolved per request: content pushes skip redeploys (`vercel.json` `ignoreCommand`). */
export function targetBranch(): string {
  return process.env.VERCEL_GIT_COMMIT_REF || useRuntimeConfig().docs.github.branch || 'main'
}

// Branch + content directory → content commit SHA pointer, shared across every instance so only one
// pays for the GitHub API call per TTL window. See `refCacheDriver()` for the single-region assumption.
const refStorage = createStorage({ driver: refCacheDriver() })
const normalizeContentDir = (contentDir: string) => contentDir.replace(/^\/+|\/+$/g, '')
const refKey = (branch: string, contentDir: string) =>
  `branch:${encodeURIComponent(branch)}:path:${encodeURIComponent(normalizeContentDir(contentDir))}`

/** Sentinel for "this ref doesn't resolve" — see the negative caching in `resolveContentSha`. */
const UNRESOLVED = '\0unresolved'

/**
 * Resolve a branch to the latest commit that touched `contentDir`.
 *
 * Callers serving attacker-supplied refs must set `cacheMisses`: `/tree/:branch` is public, so with
 * no negative entry every missing-branch request costs an authenticated GitHub call — an
 * unauthenticated way to burn the token's rate limit. Off by default because the production branch
 * must not be negative-cached: GitHub answers 404, not 403, for a repo a token can't see, so a
 * rotated token looks like a missing ref and caching that downs the site for the TTL.
 */
export async function resolveContentSha(
  branch: string,
  contentDir: string,
  opts: { cacheMisses?: boolean; refresh?: boolean } = {}
): Promise<string> {
  if (import.meta.dev) return branch

  const key = refKey(branch, contentDir)
  if (!opts.refresh) {
    const cached = await refStorage.getItem<string>(key)
    if (cached === UNRESOLVED) {
      throw createError({ statusCode: 404, statusMessage: `Ref not found: ${branch}` })
    }
    if (cached) return cached
  }

  const token = githubToken()
  let commits: Array<{ sha: string }>
  try {
    commits = await $fetch<Array<{ sha: string }>>(`https://api.github.com/repos/${githubRepo()}/commits`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      query: {
        sha: branch,
        path: normalizeContentDir(contentDir),
        per_page: 1,
      },
    })
  } catch (error: unknown) {
    // Only a definitive 404 is cacheable; a 5xx, rate-limit 403 or network blip stays retryable.
    const failure = error as { statusCode?: number; response?: { status?: number } }
    const status = failure.statusCode ?? failure.response?.status
    if (status === 404) {
      if (opts.cacheMisses) await refStorage.setItem(key, UNRESOLVED)
      throw createError({ statusCode: 404, statusMessage: `Ref not found: ${branch}` })
    }
    throw error
  }

  const sha = commits[0]?.sha
  if (!sha) {
    if (opts.cacheMisses) await refStorage.setItem(key, UNRESOLVED)
    throw createError({ statusCode: 404, statusMessage: `Content not found at ref: ${branch}` })
  }

  await refStorage.setItem(key, sha)
  return sha
}

/** Label a maintainer adds to a fork PR to make its commits previewable. */
export const PREVIEW_LABEL = 'preview:enabled'

interface GitHubPullSummary {
  number: number
  head?: { sha?: string; repo?: { full_name?: string } | null }
  labels?: Array<{ name?: string }>
}

function githubHeaders(): Record<string, string> {
  const token = githubToken()
  return {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

/** Whether a definitively missing resource caused this error (vs. a retryable failure). */
function isNotFound(error: unknown): boolean {
  const failure = error as { statusCode?: number; response?: { status?: number } }
  const status = failure.statusCode ?? failure.response?.status
  // 422 is GitHub's answer for a malformed/unknown object in `/compare` and short-SHA lookups.
  return status === 404 || status === 422
}

/**
 * A PR's commits may be previewed when the PR comes from the content repo itself (its authors could
 * push a branch and use `/tree/` anyway) or when a maintainer vouched for it with the preview label.
 */
function pullAllowsPreview(pull: GitHubPullSummary): boolean {
  if (pull.head?.repo?.full_name === githubRepo()) return true
  return (pull.labels ?? []).some((label) => label.name === PREVIEW_LABEL)
}

/**
 * Authorize a `/blob/:sha` preview and resolve it to the full 40-char SHA.
 *
 * GitHub shares git objects across the fork network: once a fork opens a PR, its head commit is
 * fetchable through the *upstream* repo API — so a bare format check would render any fork's
 * markdown on this domain. A SHA is previewable when:
 *
 * 1. an associated PR allows it (same-repo PR, or a fork PR carrying `preview:enabled`), or
 * 2. the commit is in the production branch's history (version-history links).
 *
 * Decisions live in the short-TTL ref cache — positive ones too, so removing the label revokes
 * access within a TTL. Skipped in dev, where refs resolve against the local checkout instead.
 */
export async function authorizePreviewSha(sha: string): Promise<string> {
  if (import.meta.dev) return sha

  const key = `preview:sha:${sha}`
  const cached = await refStorage.getItem<string>(key)
  if (cached === UNRESOLVED) {
    throw createError({ statusCode: 404, statusMessage: `No preview available for commit: ${sha}` })
  }
  if (cached) return cached

  const deny = async (): Promise<never> => {
    await refStorage.setItem(key, UNRESOLVED)
    throw createError({ statusCode: 404, statusMessage: `No preview available for commit: ${sha}` })
  }

  // Resolve short SHAs and confirm the commit exists in the repo network at all.
  let fullSha: string
  try {
    const commit = await $fetch<{ sha: string }>(
      `https://api.github.com/repos/${githubRepo()}/commits/${sha}`,
      { headers: githubHeaders() }
    )
    fullSha = commit.sha
  } catch (error: unknown) {
    if (isNotFound(error)) return deny()
    throw error
  }

  // PRs associated with the commit — this is how fork PR commits get vouched for.
  const pulls = await $fetch<GitHubPullSummary[]>(
    `https://api.github.com/repos/${githubRepo()}/commits/${fullSha}/pulls`,
    { headers: githubHeaders(), query: { per_page: 30 } }
  )
  let allowed = pulls.some(pullAllowsPreview)

  // No vouching PR: allow commits already in the production branch's history (version history links).
  if (!allowed) {
    try {
      const comparison = await $fetch<{ status: string }>(
        `https://api.github.com/repos/${githubRepo()}/compare/${encodeURIComponent(targetBranch())}...${fullSha}`,
        { headers: githubHeaders() }
      )
      allowed = comparison.status === 'identical' || comparison.status === 'behind'
    } catch (error: unknown) {
      if (!isNotFound(error)) throw error
    }
  }

  if (!allowed) return deny()

  await refStorage.setItem(key, fullSha)
  return fullSha
}

/**
 * Authorize a `/pr/:number` preview and resolve it to the PR's head commit SHA.
 *
 * Same rule as `authorizePreviewSha`: same-repo PRs are always previewable, fork PRs only with the
 * `preview:enabled` label. Cached in the short-TTL ref cache so the preview follows new pushes and
 * label removal revokes it within a TTL.
 */
export async function resolvePullPreviewSha(number: number): Promise<string> {
  const key = `preview:pr:${number}`
  const cached = await refStorage.getItem<string>(key)
  if (cached === UNRESOLVED) {
    throw createError({ statusCode: 404, statusMessage: `No preview available for PR #${number}` })
  }
  if (cached) return cached

  const deny = async (): Promise<never> => {
    await refStorage.setItem(key, UNRESOLVED)
    throw createError({ statusCode: 404, statusMessage: `No preview available for PR #${number}` })
  }

  let pull: GitHubPullSummary
  try {
    pull = await $fetch<GitHubPullSummary>(`https://api.github.com/repos/${githubRepo()}/pulls/${number}`, {
      headers: githubHeaders(),
    })
  } catch (error: unknown) {
    if (isNotFound(error)) return deny()
    throw error
  }

  const sha = pull.head?.sha
  if (!sha || !pullAllowsPreview(pull)) return deny()

  await refStorage.setItem(key, sha)
  return sha
}

export interface PageCommit {
  sha: string
  shortSha: string
  message: string
  author?: string
  avatarUrl?: string
  date?: string
  /** The version production currently serves (the head commit). */
  production?: boolean
}

/** Lead the list with the head commit, flagged, deduped against the file history. */
export function withProductionHead(head: PageCommit | null, commits: PageCommit[]): PageCommit[] {
  if (!head) return commits
  const rest = commits.filter((c) => c.sha !== head.sha)
  return [{ ...head, production: true }, ...rest]
}
