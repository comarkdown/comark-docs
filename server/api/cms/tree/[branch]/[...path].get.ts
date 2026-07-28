/**
 * Per-branch data endpoint. Resolve sha to share the same cache entry.
 */
export default defineEventHandler(async (event) => {
  const rawBranch = getRouterParam(event, 'branch')
  const path = getRouterParam(event, 'path')
  if (!rawBranch || !path) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch or path' })
  }

  // Public endpoint: every distinct value here costs a GitHub API call in
  // `resolveSha` and a preview-CMS instance, so validate before spending either.
  const branch = parseBranchName(decodeURIComponent(rawBranch))
  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid branch name' })
  }

  // `cacheMisses`: this ref comes from the URL, so a miss must not cost a GitHub
  // API call every time it's repeated.
  const sha = await resolveSha(branch, { cacheMisses: true })
  const cms = await getPreviewCMS(sha, `/api/cms/tree/${encodeURIComponent(branch)}`)

  return await cms.handler(toWebRequest(event))
})
