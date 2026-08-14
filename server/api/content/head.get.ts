/**
 * The commit SHA production content is pinned to, or `null` in dev
 */
export default defineEventHandler(async () => {
  await getProdContent()

  return { sha: import.meta.dev ? null : getHeadRef() }
})
