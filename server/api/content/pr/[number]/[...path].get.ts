/**
 * Per-pull-request data endpoint: `/pr/:number` previews the PR's head commit. Follows new pushes
 * (the number → head SHA pointer lives in the short-TTL ref cache) and enforces the preview
 * authorization: same-repo PRs always, fork PRs only with the `preview:enabled` label.
 */
export default defineEventHandler(async (event) => {
  const rawNumber = getRouterParam(event, 'number')
  const path = getRouterParam(event, 'path')
  if (!rawNumber || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing PR number or path' })
  }

  // Public endpoint: every distinct number costs a GitHub API call and a preview-content instance.
  const number = parsePullNumber(rawNumber)
  if (!number) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PR number' })
  }

  const sha = await resolvePullPreviewSha(number)
  const content = await getPreviewContent(sha, `/api/content/pr/${number}`)

  return await content.handler(toWebRequest(event))
})
