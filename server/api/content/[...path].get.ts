/**
 * Single data endpoint: `cms.handler()` dispatches `get`, `navigation`, `list` and custom handlers
 * (e.g. `search-sections`). Cached per-URL — see `routeRules`.
 */
export default defineEventHandler(async (event) => {
  const cms = await getProdContent()

  return cms.handler(toWebRequest(event))
})
