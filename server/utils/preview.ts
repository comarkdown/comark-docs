import type { DocsContent } from './content'

// Preview instances for `/blob/:sha`, `/tree/:branch` and `/pr/:number`.
const previews = new Map<string, DocsContent>()

const MAX_PREVIEW_INSTANCES = 8

function getPreviewContent(sha: string): DocsContent {
  const existing = previews.get(sha)
  if (existing) {
    previews.delete(sha)
    previews.set(sha, existing)
    return existing
  }

  const instance = contentAt(sha)
  previews.set(sha, instance)

  while (previews.size > MAX_PREVIEW_INSTANCES) {
    const oldest = previews.keys().next()
    if (oldest.done) break
    const evicted = previews.get(oldest.value)
    previews.delete(oldest.value)
    void evicted?.dispose().catch(() => {})
  }

  return instance
}

/**
 * Serve a preview request through the instance pinned to `sha`.
 */
export async function servePreview(event: Parameters<typeof toWebRequest>[0], sha: string, segment: string) {
  const request = toWebRequest(event)
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(segment, '')
  const rewritten = new Request(url, request)

  if (sha === getHeadSha()) {
    const instance = await getProdContent()
    // Recheck after promise resolves.
    if (sha === getHeadSha()) return instance.handler(rewritten)
  }
  return getPreviewContent(sha).handler(rewritten)
}
