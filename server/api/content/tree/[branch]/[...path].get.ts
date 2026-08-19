/** Per-branch data endpoint. Resolve sha to share the same cache entry. */
export default defineEventHandler(async (event) => {
  const rawBranch = getRouterParam(event, 'branch')
  const path = getRouterParam(event, 'path')
  if (!rawBranch || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch or path' })
  }

  // Public endpoint: every distinct ref costs a GitHub API call and a preview-content instance — validate first.
  const branch = parseBranchName(decodeURIComponent(rawBranch))
  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid branch name' })
  }

  // `cacheMisses`: the ref comes from the URL, so a miss must not re-cost a GitHub call each time.
  const sha = await resolveSha(branch, { cacheMisses: true })
  const content = await getPreviewContent(sha, `/api/content/tree/${encodeURIComponent(branch)}`)

  return await content.handler(toWebRequest(event))
})
