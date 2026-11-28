import { getAgentSiteUrl } from '#agent-discovery'
import { createError, defineEventHandler, getQuery, getRequestHeader } from 'nuxt/server'
import type { RequestEvent } from 'nuxt/server'
import { joinURL } from 'ufo'

/** A search query, not a document: anything larger is refused before it is buffered. */
const MAX_QUERY_BODY = 16 * 1024

/**
 * Search for agents (https://blog.cloudflare.com/search-for-agents/): ranked documentation sections as
 * Markdown, for `GET ?q=` and the HTTP `QUERY` method (RFC 10008) with a plain-text or JSON body. Reads
 * production content, like the MCP `search-docs` tool, through the same index.
 */
export default defineEventHandler(async (event) => {
  const method = event.req.method
  if (method !== 'GET' && method !== 'QUERY') {
    event.res.headers.set('allow', 'GET, QUERY')
    throw createError({ status: 405, statusText: 'Method not allowed' })
  }

  let query = String(getQuery(event).q ?? '')
  if (method === 'QUERY') {
    const body = await readQueryBody(event)
    const mediaType = getRequestHeader(event, 'content-type')?.split(';')[0]!.trim().toLowerCase()
    try {
      query = mediaType === 'application/json' ? String(JSON.parse(body).q ?? '') : body
    } catch {
      throw createError({ status: 400, statusText: 'Invalid JSON body' })
    }
  }
  query = query.trim()
  if (!query) throw createError({ status: 400, statusText: 'Missing `q` parameter' })

  const sections = await searchDocSections(await getProdContent(), query)
  const siteUrl = getAgentSiteUrl(event)
  const results = sections.map((section) => {
    const heading = [...section.titles, section.title].filter(Boolean).join(' > ')
    return `## ${heading}\n\nURL: ${joinURL(siteUrl, section.id)}${section.content ? `\n\n${section.content}` : ''}`
  })

  event.res.headers.set('content-type', 'text/markdown; charset=utf-8')
  if (!results.length) return `# No results for: "${query}"\n\nTry fewer or broader terms, or browse ${joinURL(siteUrl, 'sitemap.md')}.\n`
  return [`# Search results for: "${query}"`, ...results].join('\n\n---\n\n') + '\n'
})

/** Read the body of a `QUERY` request, refusing it with a 413 once it outgrows {@link MAX_QUERY_BODY}. */
async function readQueryBody(event: RequestEvent): Promise<string> {
  // On h3 v1, `event.req` is built without a body for methods other than PATCH, POST, PUT, and DELETE,
  // so read the node request it wraps. On h3 v2, `event.req` is the request itself.
  const stream = (event as { node?: { req: AsyncIterable<Uint8Array> } }).node?.req ?? event.req.body
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of stream ?? []) {
    size += chunk.byteLength
    if (size > MAX_QUERY_BODY) throw createError({ status: 413, statusText: 'Query body too large' })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}
