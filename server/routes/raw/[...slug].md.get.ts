import { findFirstLeaf } from '../../../utils/first-leaf'

export default defineEventHandler(async (event) => {
  const slug = getRouterParams(event)['slug.md']
  if (!slug?.endsWith('.md')) {
    return notFoundMarkdown(event, event.path)
  }

  const content = await getProdContent()

  const path = pagePathFromRawSlug(slug)
  const markdown = await renderPageMarkdown(content, path)
  if (!markdown) {
    // A directory without an index page (e.g. /raw/getting-started.md) redirects to the
    // mirror of its first navigation page — same behaviour as the HTML pages.
    const firstLeaf = findFirstLeaf(await content.navigation(), path)
    if (firstLeaf) {
      return sendRedirect(event, `/raw${firstLeaf}.md`, 302)
    }
    return notFoundMarkdown(event, path)
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Vary', 'Accept')
  return markdown
})
