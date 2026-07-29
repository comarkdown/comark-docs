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

// Branch → commit SHA pointer, shared across every instance so only one pays for the GitHub API
// call per TTL window. See `refCacheDriver()` for the single-region assumption this relies on.
const refStorage = createStorage({ driver: refCacheDriver() })
const refKey = (branch: string) => `branch:${branch}`

/** Sentinel for "this ref doesn't resolve" — see the negative caching in `resolveSha`. */
const UNRESOLVED = '\0unresolved'

/**
 * Resolve a branch name to its tip commit SHA.
 *
 * Callers serving attacker-supplied refs must set `cacheMisses`: `/tree/:branch` is public, so with
 * no negative entry every missing-branch request costs an authenticated GitHub call — an
 * unauthenticated way to burn the token's rate limit. Off by default because the production branch
 * must not be negative-cached: GitHub answers 404, not 403, for a repo a token can't see, so a
 * rotated token looks like a missing ref and caching that downs the site for the TTL.
 */
export async function resolveSha(branch: string, opts: { cacheMisses?: boolean } = {}): Promise<string> {
  if (import.meta.dev) return branch

  const cached = await refStorage.getItem<string>(refKey(branch))
  if (cached === UNRESOLVED) {
    throw createError({ statusCode: 404, statusMessage: `Ref not found: ${branch}` })
  }
  if (cached) return cached

  const token = githubToken()
  let commit: { sha: string }
  try {
    commit = await $fetch<{ sha: string }>(`https://api.github.com/repos/${githubRepo()}/commits/${branch}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
  } catch (error: any) {
    // Only a definitive 404 is cacheable; a 5xx, rate-limit 403 or network blip stays retryable.
    const status = error?.statusCode ?? error?.response?.status
    if (status === 404) {
      if (opts.cacheMisses) await refStorage.setItem(refKey(branch), UNRESOLVED)
      throw createError({ statusCode: 404, statusMessage: `Ref not found: ${branch}` })
    }
    throw error
  }

  await refStorage.setItem(refKey(branch), commit.sha)
  return commit.sha
}

/**
 * Write-through, so the revalidate webhook needn't wait for the next `resolveSha` TTL window — this
 * stops freshly-purged ISR pages re-rendering against a stale SHA. Reaches only the region running
 * it (see `refCacheDriver()`); other regions self-heal via TTL.
 */
export async function cacheSha(branch: string, sha: string): Promise<void> {
  await refStorage.setItem(refKey(branch), sha)
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
