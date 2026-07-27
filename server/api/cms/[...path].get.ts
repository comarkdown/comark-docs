/**
 * Single data endpoint backed by `cms.handler()`.
 *
 * Forwards the request to `cms.handler(request)`, which dispatches `get`,
 * `navigation`, `list`, and custom handlers (e.g. `search-sections`).
 *
 * `getProdCMS()` resolves the shared head and rebuilds the instance if it has
 * advanced before serving content.
 *
 * Caching is per-URL (see `routeRules`).
 */
export default defineEventHandler(async (event) => {
  const cms = await getProdCMS()

  return cms.handler(toWebRequest(event))
})
