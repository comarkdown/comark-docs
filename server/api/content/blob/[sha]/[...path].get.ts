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

  // Head-of-branch requests reuse the shared prod instance (same source ref, same per-SHA cache
  // namespace) instead of minting a duplicate preview instance that would pin an LRU slot with a
  // clone of production. Re-checked after `getProdContent()`, which may advance the head.
  if (sha === getHeadRef()) {
    const prod = await getProdContent()
    if (sha === getHeadRef()) {
      const request = toWebRequest(event)
      const url = new URL(request.url)
      url.pathname = url.pathname.replace(`/blob/${rawSha}`, '')
      return await prod.handler(new Request(url, request))
    }
  }

  const content = await getPreviewContent(sha, `/api/content/blob/${sha}`)

  return await content.handler(toWebRequest(event))
})
