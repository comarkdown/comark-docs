/** Raw markdown mirror of `/tree/:branch/**` preview pages. */
export default defineEventHandler(async (event) => {
  const rawBranch = getRouterParam(event, 'branch')
  const slug = getRouterParams(event)['slug.md']
  if (!rawBranch || !slug?.endsWith('.md')) {
    return notFoundMarkdown(event, event.path)
  }

  // Public endpoint: every distinct ref costs a GitHub API call and a preview-content instance — validate first.
  const branch = parseBranchName(decodeURIComponent(rawBranch))
  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid branch name' })
  }

  // `cacheMisses`: the ref comes from the URL, so a miss must not re-cost a GitHub call each time.
  const sha = await resolveContentSha(branch, useRuntimeConfig(event).docs.contentDir, { cacheMisses: true })
  // Same basePath key as the `/api/content/tree` route, so both share one preview instance per ref.
  const content = await getPreviewContent(sha, `/api/content/tree/${encodeURIComponent(branch)}`)

  const path = pagePathFromRawSlug(slug)
  const markdown = await renderPageMarkdown(content, path)
  if (!markdown) {
    return notFoundMarkdown(event, path)
  }

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Vary', 'Accept')
  return markdown
})
