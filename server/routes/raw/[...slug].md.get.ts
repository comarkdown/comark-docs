export default defineEventHandler(async (event) => {
  const slug = getRouterParams(event)['slug.md']
  if (!slug?.endsWith('.md')) {
    return notFoundMarkdown(event, event.path)
  }

  const content = await getProdContent()

  const path = pagePathFromRawSlug(slug)
  const markdown = await renderPageMarkdown(content, path)
  if (!markdown) {
    return notFoundMarkdown(event, path)
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Vary', 'Accept')
  return markdown
})
