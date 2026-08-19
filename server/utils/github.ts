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
