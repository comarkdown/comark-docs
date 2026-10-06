import { useAppConfig } from 'nitropack/runtime'
import { joinURL } from 'ufo'

// RSS 2.0 feed of every docs page, last-modified dates from git. ISR-cached; purged by the push webhook.

const cdata = (value: string) => `<![CDATA[${value.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`

// XML-escape element text: URLs and ids can't use CDATA the way titles and descriptions do, and one raw `&`
// in a slug or query string makes the whole feed unparseable.
const escapeXml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

export default defineEventHandler(async (event) => {
  const content = await getProdContent()
  const site = getSiteConfig(event)
  const appConfig = useAppConfig(event)
  const siteUrl = site.url || '/'
  const siteName = appConfig.seo?.siteName || site.name || ''
  const rssTitle = appConfig.docs?.rss?.title || `${siteName} Documentation`

  const pages = await listDocsPages(content)
  const dates = await docsPageDates(content)

  const items = pages
    .map((page) => {
      const date = dates.get(page.path)
      return [
        '        <item>',
        `            <title>${cdata(page.title)}</title>`,
        `            <link>${escapeXml(joinURL(siteUrl, page.path))}</link>`,
        `            <guid isPermaLink="false">${escapeXml(page.path)}</guid>`,
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
        <link>${escapeXml(siteUrl)}</link>
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
