/**
 * Sitemap source for `@nuxtjs/sitemap`: every public page, with pages hidden from the sidebar included,
 * and `lastmod` from the last commit touching each page's source file.
 */
export default defineEventHandler(async () => {
  const content = await getProdContent()
  const [pages, dates] = await Promise.all([listDocsPages(content), docsPageDates(content)])

  const url = (loc: string) => {
    const lastmod = dates.get(loc)
    return lastmod ? { loc, lastmod } : { loc }
  }
  return [url('/'), { loc: '/logos' }, ...pages.map((page) => url(page.path))]
})
