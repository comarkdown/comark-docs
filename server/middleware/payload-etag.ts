/**
 * A weak ETag on `_payload.json`, so client-side navigation on prod pages (cached via `isr`) can
 * send a conditional request instead of always re-downloading the payload body.
 *
 * Prod only. Previews (`/tree/**`, `/blob/**`, `/pr/**`) render from their own pinned instance
 * (see `servePreview`), not the prod pin/branch head `resolveProdSha()` tracks, so that SHA
 * wouldn't validate their content — and previews are low-traffic and `noindex`, so skipping the
 * ETag there (full re-download on every nav, same as before this file existed) beats resolving a
 * second, preview-specific SHA on every request just to cover them too.
 *
 * Vercel's edge already answers `304` from a stored ISR entry once its response carries an
 * `etag` — this only supplies the header, it does not compare `if-none-match` itself. On an edge
 * MISS the function's own `304` risks being *stored* as the ISR entry (every later visitor
 * getting an empty body until the next revalidation) — confirm the edge's behavior on a preview
 * deploy before adding that shortcut here.
 */
export default defineEventHandler(async (event) => {
  if (import.meta.dev) return

  const { pathname } = getRequestURL(event)
  if (!pathname.endsWith('/_payload.json')) return
  if (/^\/(?:tree|blob|pr)\//.test(pathname)) return

  let sha: string
  try {
    sha = await resolveProdSha()
  } catch {
    return
  }

  // Weak: the SHA identifies the content revision the payload was built from
  setResponseHeader(event, 'etag', `W/"${sha}"`)
})
