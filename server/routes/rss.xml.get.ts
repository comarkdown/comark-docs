import type { NavigationItem } from '@comark/cms'
import { joinURL } from 'ufo'

/**
 * RSS 2.0 feed of every docs page, with per-page last-modified dates from git.
 * ISR-cached; purged by the push webhook on content changes.
 *
 * Dates come from one batched GitHub GraphQL query in production (aliased
 * `history(first:1, path:)` per file at the pinned SHA) and from local
 * `git log` in development.
 */

interface FeedPage {
  path: string
  title: string
  description?: string
  repoPath: string
}

const cdata = (value: string) => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`

export default defineEventHandler(async (event) => {
  const cms = await getProdCMS()
  const navigation = await cms.navigation()
  const site = getSiteConfig(event)
  const appConfig = useAppConfig(event)
  const siteUrl = site.url || '/'
  const siteName = appConfig.seo?.siteName || site.name || ''
  const rssTitle = appConfig.docs?.rss?.title || `${siteName} Documentation`

  // Collect every page from navigation, mapped to its repo file for git history.
  const pages: FeedPage[] = []
  const collect = (items: NavigationItem[]) => {
    for (const item of items) {
      if (item.page !== false && item.path) {
        const entry = cms.stat(item.path)
        if (entry && entry.meta.kind === 'document') {
          pages.push({
            path: item.path,
            title: item.title,
            description: item.description,
            repoPath: `${contentPrefix()}${entry.meta.stem}${entry.meta.extension}`,
          })
        }
      }
      if (item.children?.length) collect(item.children)
    }
  }
  collect(navigation)

  const dates = await lastModifiedDates(pages.map((page) => page.repoPath))

  const items = pages
    .map((page) => {
      const date = dates.get(page.repoPath)
      return [
        '        <item>',
        `            <title>${cdata(page.title)}</title>`,
        `            <link>${joinURL(siteUrl, page.path)}</link>`,
        `            <guid isPermaLink="false">${page.path}</guid>`,
        date ? `            <pubDate>${new Date(date).toUTCString()}</pubDate>` : '',
        page.description ? `            <description>${cdata(page.description)}</description>` : '',
        siteName ? `            <author>${cdata(siteName)}</author>` : '',
        '        </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')

  const lastBuildDate = [...dates.values()].reduce(
    (max, date) => (new Date(date) > new Date(max) ? date : max),
    new Date(0).toISOString()
  )

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
    <channel>
        <title>${cdata(rssTitle)}</title>
        <link>${siteUrl}</link>
        <description>${cdata(site.description || rssTitle)}</description>
        <lastBuildDate>${(dates.size ? new Date(lastBuildDate) : new Date()).toUTCString()}</lastBuildDate>
        <docs>https://validator.w3.org/feed/docs/rss2.html</docs>
        <language>en</language>
${items}
    </channel>
</rss>
`

  setHeader(event, 'Content-Type', 'application/rss+xml; charset=utf-8')
  return xml
})

/** repoPath → ISO date of the last commit touching it. */
async function lastModifiedDates(repoPaths: string[]): Promise<Map<string, string>> {
  const dates = new Map<string, string>()

  // Development: local git log per file.
  if (process.env.NODE_ENV === 'development') {
    await Promise.all(
      repoPaths.map(async (repoPath) => {
        const [commit] = await gitLocalFileHistory(repoPath, 1)
        if (commit?.date) dates.set(repoPath, commit.date)
      })
    )
    return dates
  }

  // Production: one aliased GraphQL query for every file at the pinned SHA,
  // cached per SHA (content pushes advance the SHA and purge this route).
  const rev = getHeadRef()
  const cache = shaCacheStorage(rev)
  const cacheKey = 'gh:rss-dates'
  const cached = await cache.getItem<Record<string, string>>(cacheKey)
  if (cached) return new Map(Object.entries(cached))

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

    await cache.setItem(cacheKey, Object.fromEntries(dates), { ttl: 60 * 60 * 24 })
  } catch (error) {
    console.error('[rss] git dates lookup failed', error)
  }

  return dates
}
