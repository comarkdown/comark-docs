import { withLeadingSlash } from 'ufo'

/**
 * Commit history for a single content page.
 */

interface PageCommit {
  sha: string
  shortSha: string
  message: string
  author?: string
  avatarUrl?: string
  date?: string
  current?: boolean
}

interface GraphQLCommitNode {
  oid: string
  messageHeadline: string
  committedDate?: string
  author?: {
    name?: string
    user?: { login: string; avatarUrl: string }
  }
}

interface GraphQLHistoryResponse {
  data?: {
    repository?: {
      object?: {
        history?: { nodes: GraphQLCommitNode[] }
      }
    }
  }
  errors?: Array<{ message: string }>
}

const HISTORY_LIMIT = 10

const HISTORY_QUERY = `
query($owner:String!,$repo:String!,$rev:String!,$path:String!,$limit:Int!){
  repository(owner:$owner,name:$repo){
    object(expression:$rev){
      ... on Commit {
        history(first:$limit, path:$path){
          nodes{ oid messageHeadline committedDate author{ name user{ login avatarUrl(size:56) } } }
        }
      }
    }
  }
}`

const toCommit = (c: GraphQLCommitNode): PageCommit => ({
  sha: c.oid,
  shortSha: c.oid.slice(0, 7),
  message: c.messageHeadline,
  author: c.author?.user?.login || c.author?.name,
  avatarUrl: c.author?.user?.avatarUrl,
  date: c.committedDate,
})

export default defineEventHandler(async (event): Promise<PageCommit[]> => {
  const raw = getQuery(event).path
  const path = typeof raw === 'string' && raw ? withLeadingSlash(raw) : '/'

  const content = await getProdContent()

  const item = await content.get(path)
  if (!item || item.meta.kind !== 'document') return []

  const repoPath = `${contentPrefix()}${item.meta.stem}${item.meta.extension}`

  // Development: read history from the local git repo (no GitHub envs needed).
  if (import.meta.dev) {
    const file = await gitLocalFileHistory(repoPath, HISTORY_LIMIT)
    return withCurrentVersion(file)
  }

  const rev = targetBranch()
  const [owner, repo] = githubRepo().split('/')

  const cache = branchCacheStorage(rev)
  const cacheKey = `gh:history:v4:${repoPath}`
  const cached = await cache.getItem<PageCommit[]>(cacheKey)
  if (cached) return cached

  try {
    const res = await $fetch<GraphQLHistoryResponse>('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(githubToken() ? { Authorization: `Bearer ${githubToken()}` } : {}),
      },
      body: {
        query: HISTORY_QUERY,
        variables: { owner, repo, rev, path: repoPath, limit: HISTORY_LIMIT },
      },
    })

    if (res.errors?.length) {
      throw new Error(res.errors.map((e) => e.message).join('; '))
    }

    const nodes = res.data?.repository?.object?.history?.nodes ?? []
    const history = withCurrentVersion(nodes.map(toCommit))

    await cache.setItem(cacheKey, history)

    return history
  } catch (error) {
    console.error(`[history] failed for ${repoPath}`, error)
    return []
  }
})
