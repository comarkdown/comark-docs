/**
 * The commit `/api/content/blob/:sha`'s search artifacts actually come from — the full 40-char SHA,
 * normalizing a short one. 404s a SHA `authorizePreviewSha` denies, so the client can hide search
 * instead of erroring on an unfetchable artifact.
 */
export default defineEventHandler(async (event) => {
  const rawSha = getRouterParam(event, 'sha')
  if (!rawSha) {
    throw createError({ statusCode: 400, statusMessage: 'Missing sha' })
  }

  const sha = parseCommitSha(rawSha)
  if (!sha) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid commit SHA' })
  }

  return { sha: await authorizePreviewSha(sha) }
})
