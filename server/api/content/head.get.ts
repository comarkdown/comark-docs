/**
 * The commit SHA production content is pinned to, or `null` in dev.
 */
export default defineEventHandler(async () => {
  if (import.meta.dev) return { sha: null }

  return { sha: await resolveProdSha() }
})
