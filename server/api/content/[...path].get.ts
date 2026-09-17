/**
 * Single data endpoint: `content.handler()` dispatches `get`, `navigation`, `list`, `manifest`
 * and `snapshot`. Must be cached per-URL by layer consumer.
 */
export default defineEventHandler(async (event) => {
  const content = await getProdContent()

  return content.handler(toWebRequest(event))
})
