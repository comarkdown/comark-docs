import { withLeadingSlash } from 'ufo'

/**
 * Commit history for a single content page.
 */

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
      defaultBranchRef?: {
        name: string
        target?: { history?: { nodes: Array<{ oid: string }> } }
      }
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
    defaultBranchRef{
      name
      target{
        ... on Commit { history(first:$limit, path:$path){ nodes{ oid } } }
      }
    }
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

export default defineEventHandler(async (event): Promise<PageHistory> => {
  const raw = getQuery(event).path
  const path = typeof raw === 'string' && raw ? withLeadingSlash(raw) : '/'

  const content = await getProdContent()
  const branch = targetBranch()

  const item = await content.get(path)
  if (!item || item.meta.kind !== 'document') return { branch, commits: [] }

  const repoPath = `${contentPrefix()}${item.meta.stem}${item.meta.extension}`

  /*
  * DEVELOPMENT: read history from the local git repo (no GitHub envs needed).
  */
  if (import.meta.dev) {
    const defaultBranch = await gitLocalDefaultBranch()
    const [file, defaultFile] = await Promise.all([
      gitLocalFileHistory(repoPath, HISTORY_LIMIT),
      gitLocalFileHistory(repoPath, HISTORY_LIMIT, `refs/remotes/origin/${defaultBranch}`),
    ])
    const defaultShas = new Set(defaultFile.map((c) => c.sha))
    const commits = withBranchOnly(withCurrentVersion(file), defaultShas)
    return { branch, defaultBranch, commits }
  }

  /*
  * PRODUCTION: read history from the GitHub API.
  */
  const [owner, repo] = githubRepo().split('/')
  const cache = branchCacheStorage(branch)
  const cacheKey = `gh:history:v8:${repoPath}`

  const cached = await cache.getItem<{ defaultBranch?: string; commits: PageCommit[] }>(cacheKey)
  if (cached) {
    return { branch, defaultBranch: cached.defaultBranch, commits: cached.commits }
  }

  try {
    const res = await $fetch<GraphQLHistoryResponse>('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(githubToken() ? { Authorization: `Bearer ${githubToken()}` } : {}),
      },
      body: {
        query: HISTORY_QUERY,
        variables: { owner, repo, rev: branch, path: repoPath, limit: HISTORY_LIMIT },
      },
    })

    if (res.errors?.length) {
      throw new Error(res.errors.map((e) => e.message).join('; '))
    }

    const repository = res.data?.repository
    const defaultBranch = repository?.defaultBranchRef?.name
    const nodes = repository?.object?.history?.nodes ?? []
    let commits = withCurrentVersion(nodes.map(toCommit))

    if (defaultBranch && defaultBranch !== branch) {
      const defaultShas = new Set((repository?.defaultBranchRef?.target?.history?.nodes ?? []).map((n) => n.oid))
      commits = withBranchOnly(commits, defaultShas)
    }

    await cache.setItem(cacheKey, { defaultBranch, commits })

    return { branch, defaultBranch, commits }
  } catch (error) {
    console.error(`[history] failed for ${repoPath}`, error)
    return { branch, commits: [] }
  }
})
