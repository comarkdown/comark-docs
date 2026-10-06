import { withLeadingSlash } from 'ufo'

/**
 * Date of the last commit touching a production page's source file, for its `dateModified`. Served
 * from the per-commit map the sitemap and the RSS feed share, so a page costs no extra GitHub call.
 */
export default defineEventHandler(async (event): Promise<{ date: string | null }> => {
  const raw = getQuery(event).path
  const path = typeof raw === 'string' && raw ? withLeadingSlash(raw) : '/'

  const dates = await docsPageDates(await getProdContent())
  return { date: dates.get(path.toLowerCase()) ?? null }
})
