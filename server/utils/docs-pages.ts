import { collectDocsPages, type DocsPage } from '../../utils/pages.ts'

/** A public page and the repo file it is read from, for git dates. */
export interface DocsPageEntry extends DocsPage {
  /** Repo-relative path of the source file (e.g. `docs/content/1.guide/2.install.md`). */
  repoPath?: string
}

/**
 * Every public page in sidebar order, once each, with directory indexes hidden from the sidebar
 * (`navigation: false`) included. Source of `sitemap.xml`, `sitemap.md`, `llms.txt` and the RSS feed, so
 * the four agree.
 */
export async function listDocsPages(content: DocsContent): Promise<DocsPageEntry[]> {
  const [navigation, documents] = await Promise.all([content.navigation(), content.list()])
  // Only a directory `index.md` comes back: a section landing the header links to. Any other hidden page
  // may be a draft (`navigation: false` is how the docs suggest keeping one out of sight).
  const hidden = documents
    .filter((doc) => doc.meta.kind === 'document' && doc.data?.navigation === false && isDirectoryIndex(doc.meta.stem))
    .map((doc) => ({ path: doc.path, title: doc.data?.title, description: doc.data?.description }))

  return collectDocsPages(navigation, hidden).map((page) => ({ ...page, repoPath: repoPathOf(content, page.path) }))
}

/** Whether a stem names a directory `index` file (`4.plugins/index`, numeric prefixes allowed). */
function isDirectoryIndex(stem: string): boolean {
  const parts = stem.split('/')
  return parts.length > 1 && parts.at(-1)!.replace(/^\d+\./, '') === 'index'
}

/** Repo-relative source file of the document at `path`, if there is one. */
function repoPathOf(content: DocsContent, path: string): string | undefined {
  const entry = content.stat(path)
  return entry?.meta.kind === 'document' ? `${contentPrefix()}${entry.meta.stem}${entry.meta.extension}` : undefined
}

/** Bump when the shape of the cached map changes. */
const DATES_CACHE_KEY = 'gh:page-dates:v1'

/**
 * Page path → ISO date of the last commit touching its source file, for every public page.
 *
 * Production reads one aliased GraphQL query at the pinned head SHA and caches it per SHA, so the sitemap,
 * the feed and every page's `dateModified` share a single lookup per content commit. Development reads the
 * local git log. A page without a commit yet (a new, uncommitted file) has no date.
 */
export async function docsPageDates(content: DocsContent): Promise<Map<string, string>> {
  const pages = [...(await listDocsPages(content)), { path: '/', title: '', repoPath: repoPathOf(content, '/') }]
  const files = pages.filter((page): page is DocsPageEntry & { repoPath: string } => Boolean(page.repoPath))
  const byFile = await lastModifiedByFile(files.map((page) => page.repoPath))

  const dates = new Map<string, string>()
  for (const page of files) {
    const date = byFile.get(page.repoPath)
    if (date) dates.set(page.path, date)
  }
  return dates
}

// One lookup in flight per content commit: a cold process renders many pages at once, and each one asks.
const pendingDates = new Map<string, Promise<Map<string, string>>>()

/** repoPath → ISO date of the last commit touching it. */
async function lastModifiedByFile(repoPaths: string[]): Promise<Map<string, string>> {
  if (import.meta.dev) {
    const all = await gitLocalLastModified(contentPrefix())
    return new Map(repoPaths.flatMap((repoPath) => (all.has(repoPath) ? [[repoPath, all.get(repoPath)!]] : [])))
  }

  const rev = getHeadRef()
  let pending = pendingDates.get(rev)
  if (!pending) {
    pending = fetchLastModified(rev, repoPaths).finally(() => pendingDates.delete(rev))
    pendingDates.set(rev, pending)
  }
  return pending
}

async function fetchLastModified(rev: string, repoPaths: string[]): Promise<Map<string, string>> {
  const cache = shaCacheStorage(rev)
  const cached = await cache.getItem<Record<string, string>>(DATES_CACHE_KEY)
  if (cached) return new Map(Object.entries(cached))

  const dates = new Map<string, string>()
  if (!repoPaths.length) return dates

  const [owner, repo] = githubRepo().split('/')
  const aliases = repoPaths
    .map((repoPath, index) => `f${index}: history(first:1, path:${JSON.stringify(repoPath)}){ nodes{ committedDate } }`)
    .join('\n          ')
  const query = `
    query($owner:String!,$repo:String!,$rev:String!){
      repository(owner:$owner,name:$repo){
        object(expression:$rev){
          ... on Commit {
            ${aliases}
          }
        }
      }
    }`

  try {
    const res = await $fetch<{
      data?: { repository?: { object?: Record<string, { nodes?: Array<{ committedDate?: string }> }> } }
      errors?: Array<{ message: string }>
    }>('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(githubToken() ? { Authorization: `Bearer ${githubToken()}` } : {}),
      },
      body: { query, variables: { owner, repo, rev } },
    })

    if (res.errors?.length) {
      throw new Error(res.errors.map((e) => e.message).join('; '))
    }

    const object = res.data?.repository?.object ?? {}
    repoPaths.forEach((repoPath, index) => {
      const date = object[`f${index}`]?.nodes?.[0]?.committedDate
      if (date) dates.set(repoPath, date)
    })

    await cache.setItem(DATES_CACHE_KEY, Object.fromEntries(dates), { ttl: 60 * 60 * 24 })
  } catch (error) {
    console.error('[dates] git dates lookup failed', error)
  }

  return dates
}
