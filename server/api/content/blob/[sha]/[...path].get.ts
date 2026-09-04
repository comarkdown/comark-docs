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

  // Head-of-branch requests reuse the shared prod instance (same source ref, same per-SHA cache
  // namespace) instead of minting a duplicate preview instance that would pin an LRU slot with a
  // clone of production. Re-checked after `getProdContent()`, which may advance the head.
  if (fullSha === getHeadRef()) {
    const prod = await getProdContent()
    if (fullSha === getHeadRef()) {
      const request = toWebRequest(event)
      const url = new URL(request.url)
      url.pathname = url.pathname.replace(`/blob/${rawSha}`, '')
      return await prod.handler(new Request(url, request))
    }
  }

  const content = await getPreviewContent(fullSha, `/api/content/blob/${sha}`)

  return await content.handler(toWebRequest(event))
})
