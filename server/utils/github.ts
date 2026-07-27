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

/**
 * Constant-time string comparison.
 */
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

/** GitHub token for source reads and API calls. */
export function githubToken(): string | undefined {
  const { docs } = useRuntimeConfig()
  return docs.githubToken || process.env.GITHUB_TOKEN || undefined
}

/**
 * Branch → commit SHA pointer, shared across every instance via `refCacheDriver()`
 * (Vercel Runtime Cache in prod, in-memory in dev) so only one instance pays for the
 * GitHub API call per TTL window. See `refCacheDriver()` for the single-region
 * assumption this relies on.
 */
const refStorage = createStorage({ driver: refCacheDriver() })
const refKey = (branch: string) => `branch:${branch}`

/**
 * Resolve a branch name to its tip commit SHA.
 */
export async function resolveSha(branch: string): Promise<string> {
  if (process.env.NODE_ENV === 'development') return branch

  const cached = await refStorage.getItem<string>(refKey(branch))
  if (cached) return cached

  const token = githubToken()
  const commit = await $fetch<{ sha: string }>(`https://api.github.com/repos/${githubRepo()}/commits/${branch}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  await refStorage.setItem(refKey(branch), commit.sha)
  return commit.sha
}

/**
 * Write-through: let the revalidate webhook push a known SHA straight into the
 * shared ref cache the moment it's determined, instead of waiting for the next
 * `resolveSha` TTL window — this is what keeps freshly-purged ISR pages from
 * re-rendering against a stale SHA right after a push. Only reaches the region
 * that runs this call (see `refCacheDriver()`); other regions still self-heal via
 * `resolveSha()`'s own TTL.
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
