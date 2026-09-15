/**
 * The commit `/api/content/tree/:branch`'s search artifacts actually come from.
 *
 * 404s when the branch doesn't resolve, or resolves to a commit `authorizePreviewSha` denies
 */
export default defineEventHandler(async (event) => {
  const rawBranch = getRouterParam(event, 'branch')
  if (!rawBranch) {
    throw createError({ statusCode: 400, statusMessage: 'Missing branch' })
  }

  // Rejects SHA-shaped values too — see `parsePreviewBranch`'s doc comment.
  const branch = parsePreviewBranch(decodeURIComponent(rawBranch))
  if (!branch) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid branch name' })
  }

  // Dev has no snapshot/GitHub pipeline: resolve against the local checkout instead, like
  // `gitLocalSource` does for the data route.
  const sha = import.meta.dev
    ? await resolveGitRef(branch)
    : await resolveContentSha(branch, useRuntimeConfig(event).docs.contentDir, { cacheMisses: true })

  return { sha: await authorizePreviewSha(sha) }
})
