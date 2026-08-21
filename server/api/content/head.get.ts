/**
 * The commit SHA production content is pinned to, or `null` in dev.
 */
export default defineEventHandler(async (event) => {
  if (import.meta.dev) return { sha: null }

  const { contentDir } = useRuntimeConfig(event).docs
  return { sha: await resolveContentSha(targetBranch(), contentDir) }
})
