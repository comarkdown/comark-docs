import { withLeadingSlash } from 'ufo'

export default defineEventHandler(async (event) => {
  const slug = getRouterParams(event)['slug.md']
  if (!slug?.endsWith('.md')) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  const content = await getProdContent()

  const stripped = slug.replace(/\.md$/, '')
  const path = stripped === 'index' ? '/' : withLeadingSlash(stripped)

  const markdown = await renderPageMarkdown(content, path)
  if (!markdown) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  return markdown
})
