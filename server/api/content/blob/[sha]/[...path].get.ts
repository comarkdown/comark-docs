/**
 * Per-commit data endpoint backed by `content.handler`
 */
export default defineEventHandler(async (event) => {
  const rawSha = getRouterParam(event, 'sha')
  const path = getRouterParam(event, 'path')
  if (!rawSha || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sha or path' })
  }

  // Public endpoint: reject anything that isn't a commit SHA before it becomes a
  // preview-content registry entry (see `getPreviewContent`) or a GitHub ref.
  const sha = parseCommitSha(rawSha)
  if (!sha) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid commit SHA' })
  }

  const content = await getPreviewContent(sha, `/api/content/blob/${sha}`)

  return await content.handler(toWebRequest(event))
})
