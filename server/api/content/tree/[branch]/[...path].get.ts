/** Per-branch data endpoint. Resolve sha to share the same cache entry. */
export default defineEventHandler(async (event) => {
  const rawBranch = getRouterParam(event, 'branch')
  const path = getRouterParam(event, 'path')
  if (!rawBranch || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch or path' })
  }

  const branch = parsePreviewBranch(decodeURIComponent(rawBranch))
  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid branch name' })
  }

  // `cacheMisses`: the ref comes from the URL, so a miss must not re-cost a GitHub call each time.
  const sha = await resolveContentSha(branch, useRuntimeConfig(event).docs.contentDir, { cacheMisses: true })
  return servePreview(event, sha, `/tree/${rawBranch}`)
})
