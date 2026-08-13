/**
 * The commit SHA production content is currently pinned to. The client-side search database
 * (see `useLocalSearch`) uses it to hydrate from the immutable `/api/content/blob/<sha>/*`
 * artifacts instead of the live endpoints, so snapshot downloads are CDN-cached forever.
 *
 * `getProdContent()` refreshes the head against the branch tip (60s shared ref cache) before
 * `getHeadRef()` is read. In dev this returns the branch name, which callers must treat as
 * "no immutable pin available".
 */
export default defineEventHandler(async () => {
  await getProdContent()
  return { sha: getHeadRef() }
})
