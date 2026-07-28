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
      // The head commit itself (production), plus the file's change history.
      object?: GraphQLCommitNode & {
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
        oid messageHeadline committedDate author{ name user{ login avatarUrl(size:56) } }
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

  const cms = await getProdCMS()

  const item = await cms.get(path)
  if (!item || item.meta.kind !== 'document') return []

  const repoPath = `${contentPrefix()}${item.meta.stem}${item.meta.extension}`

  // Development: read history from the local git repo (no GitHub envs needed).
  if (import.meta.dev) {
    const [head, file] = await Promise.all([gitLocalHeadCommit(), gitLocalFileHistory(repoPath, HISTORY_LIMIT)])
    return withProductionHead(head, file)
  }

  const rev = getHeadRef()
  const [owner, repo] = githubRepo().split('/')

  const cache = shaCacheStorage(rev)
  const cacheKey = `gh:history:v3:${repoPath}`
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

    const object = res.data?.repository?.object
    const head = object ? toCommit(object) : null
    const file = (object?.history?.nodes ?? []).map(toCommit)
    const history = withProductionHead(head, file)

    await cache.setItem(cacheKey, history, { ttl: 300 })

    return history
  } catch (error) {
    console.error(`[history] failed for ${repoPath}`, error)
    return []
  }
})
