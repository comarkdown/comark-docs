/** Raw markdown mirror of `/blob/:sha/**` preview pages. */
export default defineEventHandler(async (event) => {
  const rawSha = getRouterParam(event, 'sha')
  const slug = getRouterParams(event)['slug.md']
  if (!rawSha || !slug?.endsWith('.md')) {
    return notFoundMarkdown(event, event.path)
  }

  // Public endpoint: reject anything that isn't a commit SHA before it becomes a
  // preview-content registry entry (see `getPreviewContent`) or a GitHub ref.
  const sha = parseCommitSha(rawSha)
  if (!sha) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid commit SHA' })
  }

  // Same basePath key as the `/api/content/blob` route, so both share one preview instance per SHA.
  const content = await getPreviewContent(sha, `/api/content/blob/${sha}`)

  const path = pagePathFromRawSlug(slug)
  const markdown = await renderPageMarkdown(content, path)
  if (!markdown) {
    return notFoundMarkdown(event, path)
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Vary', 'Accept')
  return markdown
})
