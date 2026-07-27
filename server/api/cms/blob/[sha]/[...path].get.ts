/**
 * Per-commit data endpoint backed by `cms.handler`
 */
export default defineEventHandler(async (event) => {
  const sha = getRouterParam(event, 'sha')
  const path = getRouterParam(event, 'path')
  if (!sha || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sha or path' })
  }

  const cms = await getPreviewCMS(sha, `/api/cms/blob/${sha}`)

  return await cms.handler(toWebRequest(event))
})
