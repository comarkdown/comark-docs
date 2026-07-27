/**
 * Per-branch data endpoint. Resolve sha to share the same cache entry.
 */
export default defineEventHandler(async (event) => {
  const branch = getRouterParam(event, 'branch')
  const path = getRouterParam(event, 'path')
  if (!branch || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch or path' })
  }

  const sha = await resolveSha(decodeURIComponent(branch))
  const cms = await getPreviewCMS(sha, `/api/cms/tree/${encodeURIComponent(branch)}`)

  return await cms.handler(toWebRequest(event))
})
