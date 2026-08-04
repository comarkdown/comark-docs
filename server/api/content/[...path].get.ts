/**
 * Single data endpoint: `content.handler()` dispatches `get`, `navigation`, `list` and custom handlers
 * (e.g. `search-sections`). Cached per-URL — see `routeRules`.
 */
export default defineEventHandler(async (event) => {
  const content = await getProdContent()

  return content.handler(toWebRequest(event))
})
