/**
 * The commit `/api/content/pr/:number`'s search artifacts actually come from: the PR's head SHA.
 *
 * `resolvePullPreviewSha` already enforces the preview policy (same-repo, or `preview:enabled` on a
 * fork), but `authorizePreviewSha` is what the artifact fetch actually goes through — re-checking
 * here keeps the two from disagreeing (e.g. paginated `/commits/:sha/pulls` truncating) and lets the
 * client hide search instead of erroring on an unfetchable artifact.
 */
export default defineEventHandler(async (event) => {
  const rawNumber = getRouterParam(event, 'number')
  if (!rawNumber) {
    throw createError({ statusCode: 400, statusMessage: 'Missing PR number' })
  }

  const number = parsePullNumber(rawNumber)
  if (!number) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid PR number' })
  }

  const sha = await resolvePullPreviewSha(number)
  return { sha: await authorizePreviewSha(sha) }
})
