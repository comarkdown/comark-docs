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

  // Fork PR commits are fetchable through the upstream repo, so a well-formed SHA is not enough:
  // only commits in upstream history or vouched for by a PR may render here (404 otherwise).
  // Also resolves short SHAs so one commit pins one content instance.
  const fullSha = await authorizePreviewSha(sha)

  const content = await getPreviewContent(fullSha, `/api/content/blob/${sha}`)

  return await content.handler(toWebRequest(event))
})
